'use strict';

const { randomUUID, timingSafeEqual, createHmac, createHash } = require('crypto');

const PRODUCT_PRICE_ZAR = 300;
const DELIVERY_PRICE_ZAR = 60;
const MAX_QUANTITY = 5;
const REQUEST_TIMEOUT_MS = 7000;
const MAX_LOCAL_ZOHO_CONCURRENCY = 2;
const MAX_BODY_BYTES = 20 * 1024;
const BOOKS_API_VERSION = 'v3';
const AVAILABILITY_CACHE_MS = 15 * 1000;
const CHECKOUT_TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const PAYMENT_VERIFICATION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const STOCK_LOCK_TTL_MS = 5 * 60 * 1000;
const CHECKOUT_PROCESSING_TTL_MS = 5 * 60 * 1000;
const WEBSITE_RESERVATION_TTL_MS = 75 * 60 * 1000;
const CONFIRMED_RESERVATION_BRIDGE_MS = 5 * 60 * 1000;
const LOCAL_ZOHO_QUEUE_WAIT_MS = 8000;
const TRANSIENT_GET_RETRY_MS = 350;
const PAYMENT_EPSILON = 0.01;

const PRODUCT_NAMES = Object.freeze({
  'Blueberry Mint': 'ELFBAR BC10000 - Blueberry Mint',
  'Miami Mint': 'ELFBAR BC10000 - Miami Mint',
  'Blue Razz Ice': 'ELFBAR BC10000 - Blue Razz Ice',
  'Strawberry Kiwi Ice': 'ELFBAR BC10000 - Strawberry Kiwi Ice',
  'Watermelon Ice': 'ELFBAR BC10000 - Watermelon Ice',
});
const DELIVERY_ITEM_NAME = 'Courier Guy Locker-to-Locker Delivery';
const PRODUCT_ITEM_ID_ENVS = Object.freeze({
  'Blueberry Mint': 'ZOHO_ITEM_BLUEBERRY_MINT_ID',
  'Miami Mint': 'ZOHO_ITEM_MIAMI_MINT_ID',
  'Blue Razz Ice': 'ZOHO_ITEM_BLUE_RAZZ_ICE_ID',
  'Strawberry Kiwi Ice': 'ZOHO_ITEM_STRAWBERRY_KIWI_ICE_ID',
  'Watermelon Ice': 'ZOHO_ITEM_WATERMELON_ICE_ID',
});
const DELIVERY_ITEM_ID_ENV = 'ZOHO_ITEM_COURIER_LOCKER_ID';
const STOCK_LOCATION_ID_ENV = 'ZOHO_LOCATION_ID';
const ALLOWED_FLAVOURS = new Set(Object.keys(PRODUCT_NAMES));

const ALLOWED_ACCOUNTS_HOSTS = new Set([
  'accounts.zoho.com', 'accounts.zoho.eu', 'accounts.zoho.in',
  'accounts.zoho.com.au', 'accounts.zoho.jp', 'accounts.zoho.ca',
  'accounts.zoho.com.cn', 'accounts.zoho.sa',
]);
const ALLOWED_API_HOSTS = new Set([
  'www.zohoapis.com', 'www.zohoapis.eu', 'www.zohoapis.in',
  'www.zohoapis.com.au', 'www.zohoapis.jp', 'www.zohoapis.ca',
  'www.zohoapis.com.cn', 'www.zohoapis.sa',
]);
const ALLOWED_PAYMENT_HOSTS = new Set([
  'books.zoho.com', 'books.zoho.eu', 'books.zoho.in', 'books.zoho.com.au',
  'books.zoho.jp', 'books.zoho.ca', 'books.zoho.com.cn', 'books.zoho.sa',
  // Zoho's documented generated invoice payment link uses this secure host.
  'zohosecurepay.com',
]);

let cachedAccessToken = null;
let cachedApiDomain = null;
let accessTokenExpiresAt = 0;
let tokenRefreshPromise = null;
let activeZohoRequests = 0;
let cachedAvailability = null;
let cachedAvailabilityUntil = 0;
let cachedDeliveryItem = null;
let cachedDeliveryItemUntil = 0;
let cachedProductCatalogUntil = 0;
const PRODUCT_CATALOG_CACHE_MS = 30 * 60 * 1000;
const resolvedProductItemIds = new Map();
let d1Database = null;

function bindCloudflareRuntime(env) {
  d1Database = env?.CHECKOUT_DB || null;
  globalThis.__VESTIGE_ENV = env || {};
}
function runtimeEnv(name) {
  const env = globalThis.__VESTIGE_ENV || {};
  const value = env[name];
  if (value !== undefined && value !== null) return value;
  return typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
}
function checkoutStorageError(error) {
  if (error?.service === 'checkout_storage') return error;
  if (error?.statusCode) return error;
  const e = new Error('Secure checkout storage is temporarily unavailable.');
  e.statusCode = 503;
  e.service = 'checkout_storage';
  e.cause = error;
  return e;
}
function requireDatabase() {
  if (!d1Database) {
    const e = new Error('Cloudflare D1 checkout storage is not bound.');
    e.statusCode = 503;
    e.service = 'checkout_storage';
    throw e;
  }
  return d1Database;
}
class D1JsonStore {
  constructor(namespace) { this.namespace = namespace; }
  async getWithMetadata(key) {
    try {
      const row = await requireDatabase().prepare(
        'SELECT value_json, etag FROM kv_store WHERE namespace = ?1 AND key = ?2'
      ).bind(this.namespace, String(key)).first();
      if (!row) return null;
      return { data: JSON.parse(row.value_json), etag: String(row.etag) };
    } catch (error) { throw checkoutStorageError(error); }
  }
  async setJSON(key, value, options = {}) {
    try {
      const db = requireDatabase();
      const k = String(key);
      const json = JSON.stringify(value);
      const etag = randomUUID();
      const now = Date.now();
      let result;
      if (options.onlyIfNew) {
        result = await db.prepare(
          'INSERT OR IGNORE INTO kv_store(namespace, key, value_json, etag, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)'
        ).bind(this.namespace, k, json, etag, now).run();
      } else if (options.onlyIfMatch) {
        result = await db.prepare(
          'UPDATE kv_store SET value_json = ?3, etag = ?4, updated_at = ?5 WHERE namespace = ?1 AND key = ?2 AND etag = ?6'
        ).bind(this.namespace, k, json, etag, now, String(options.onlyIfMatch)).run();
      } else {
        result = await db.prepare(
          'INSERT INTO kv_store(namespace, key, value_json, etag, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(namespace, key) DO UPDATE SET value_json = excluded.value_json, etag = excluded.etag, updated_at = excluded.updated_at'
        ).bind(this.namespace, k, json, etag, now).run();
      }
      const changes = Number(result?.meta?.changes || 0);
      return { modified: changes > 0, etag: changes > 0 ? etag : null };
    } catch (error) { throw checkoutStorageError(error); }
  }
  async delete(key) {
    try {
      await requireDatabase().prepare('DELETE FROM kv_store WHERE namespace = ?1 AND key = ?2')
        .bind(this.namespace, String(key)).run();
    } catch (error) { throw checkoutStorageError(error); }
  }
}
const STORES = new Map();
function getD1Store(name) {
  if (!STORES.has(name)) STORES.set(name, new D1JsonStore(name));
  return STORES.get(name);
}
async function getStockLockStore() { return getD1Store('vestige-stock-locks'); }
async function getCheckoutStore() { return getD1Store('vestige-checkouts'); }
async function getReservationStore() { return getD1Store('vestige-stock-reservations'); }
async function testAtomicBlobStore(store, label) {
  const key = `health-${label}-${randomUUID()}`;
  const first = { phase: 1, nonce: randomUUID(), at: Date.now() };
  try {
    const created = await store.setJSON(key, first, { onlyIfNew: true });
    if (!created?.modified || !created?.etag) throw new Error(`Atomic D1 create was not confirmed for ${label}.`);
    const read1 = await store.getWithMetadata(key);
    if (!read1?.data || read1.data.nonce !== first.nonce || !read1.etag) throw new Error(`D1 read was not confirmed for ${label}.`);
    const second = { ...first, phase: 2 };
    const updated = await store.setJSON(key, second, { onlyIfMatch: read1.etag });
    if (!updated?.modified || !updated?.etag) throw new Error(`Conditional D1 update was not confirmed for ${label}.`);
    const read2 = await store.getWithMetadata(key);
    if (!read2?.data || read2.data.phase !== 2) throw new Error(`Updated D1 state was not visible for ${label}.`);
    return { ok: true, strongConsistency: true, atomicConditionalWrites: true, backend: 'Cloudflare D1' };
  } finally {
    try { await store.delete(key); } catch (_) {}
  }
}
async function testCheckoutStorage() {
  try {
    const [checkouts, reservations, locks] = await Promise.all([getCheckoutStore(), getReservationStore(), getStockLockStore()]);
    const stores = {
      checkouts: await testAtomicBlobStore(checkouts, 'checkouts'),
      reservations: await testAtomicBlobStore(reservations, 'reservations'),
      locks: await testAtomicBlobStore(locks, 'locks'),
    };
    return { ok: true, strongConsistency: true, atomicConditionalWrites: true, backend: 'Cloudflare D1', stores };
  } catch (cause) {
    const e = new Error('Cloudflare D1 checkout storage failed its atomic read/write test.');
    e.statusCode = 503;
    e.service = 'checkout_storage';
    e.cause = cause;
    throw e;
  }
}
function orderFingerprint(order) {
  // Every field that can change the Zoho customer/order record participates in the
  // durable idempotency fingerprint. A retry is replay-safe only for the exact same
  // commercial/customer instruction; editing billing/contact data creates a new order.
  const stable = JSON.stringify({
    checkoutId: order.checkoutId,
    customerName: order.customerName,
    email: order.email,
    mobile: order.mobile,
    addressLine1: order.addressLine1,
    addressLine2: order.addressLine2,
    city: order.city,
    province: order.province,
    postalCode: order.postalCode,
    country: order.country,
    courierLocker: order.courierLocker,
    flavour: order.flavour,
    itemId: order.itemId,
    quantity: order.quantity,
    amount: order.amount,
  });
  return createHash('sha256').update(stable).digest('hex');
}
async function beginCheckoutAttempt(order) {
  let store;
  try { store = await getCheckoutStore(); } catch (error) { throw checkoutStorageError(error); }
  const key = `checkout-${order.checkoutId}`;
  const fingerprint = orderFingerprint(order);
  const ownerId = randomUUID();
  const now = Date.now();
  const processing = { state: 'processing', fingerprint, ownerId, progress: {}, expiresAt: now + CHECKOUT_PROCESSING_TTL_MS, updatedAt: now };
  let result = await store.setJSON(key, processing, { onlyIfNew: true });
  if (result?.modified) return { store, key, fingerprint, ownerId, replay: null, progress: {} };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    if (!current) {
      result = await store.setJSON(key, processing, { onlyIfNew: true });
      if (result?.modified) return { store, key, fingerprint, ownerId, replay: null, progress: {} };
      continue;
    }
    const data = current.data || {};
    if (data.fingerprint && data.fingerprint !== fingerprint) {
      const e = new Error('This checkout identifier belongs to a different order. The shop will generate a new checkout for changed order details.');
      e.statusCode = 409;
      throw e;
    }
    if (data.state === 'pending_payment' && data.response && data.fingerprint === fingerprint) {
      return { store, key, fingerprint, ownerId: null, replay: data.response, progress: data.progress || {} };
    }
    if (data.state === 'confirmed' && data.response && data.fingerprint === fingerprint) {
      return { store, key, fingerprint, ownerId: null, replay: data.response, progress: data.progress || {} };
    }
    if (data.state === 'processing' && Number(data.expiresAt || 0) > now) {
      const e = new Error('This checkout is already being processed. Please wait a moment and try again.');
      e.statusCode = 503;
      e.retryAfter = '2';
      throw e;
    }
    const takeover = { ...processing, fingerprint, progress: data.progress || {} };
    result = await store.setJSON(key, takeover, { onlyIfMatch: current.etag });
    if (result?.modified) return { store, key, fingerprint, ownerId, replay: null, progress: takeover.progress };
  }
  const e = new Error('Unable to safely acquire the checkout transaction. Please try again.');
  e.statusCode = 503;
  e.retryAfter = '2';
  throw e;
}
async function saveCheckoutProgress(ctx, patch) {
  if (!ctx?.store || !ctx?.key || !ctx?.ownerId) return;
  const current = await ctx.store.getWithMetadata(ctx.key, { type: 'json', consistency: 'strong' });
  if (!current || String(current.data?.ownerId || '') !== String(ctx.ownerId) || current.data?.state !== 'processing') {
    const e = new Error('Checkout transaction ownership was lost while recording progress.'); e.statusCode = 503; e.retryAfter = '2'; throw e;
  }
  const progress = { ...(current.data?.progress || {}), ...(patch || {}) };
  const record = { ...current.data, progress, updatedAt: Date.now(), expiresAt: Date.now() + CHECKOUT_PROCESSING_TTL_MS };
  const result = await ctx.store.setJSON(ctx.key, record, { onlyIfMatch: current.etag });
  if (!result?.modified) { const e = new Error('Unable to persist checkout progress safely.'); e.statusCode = 503; e.retryAfter = '2'; throw e; }
  ctx.progress = progress;
}
async function saveCheckoutPending(ctx, response) {
  if (!ctx?.store || !ctx?.key || !ctx?.ownerId) return;
  const current = await ctx.store.getWithMetadata(ctx.key, { type: 'json', consistency: 'strong' });
  if (!current || String(current.data?.ownerId || '') !== String(ctx.ownerId)) {
    const e = new Error('Checkout transaction ownership was lost before completion.'); e.statusCode = 503; throw e;
  }
  const record = {
    state: 'pending_payment',
    fingerprint: ctx.fingerprint,
    progress: current.data?.progress || ctx.progress || {},
    response,
    updatedAt: Date.now(),
    expiresAt: Date.now() + PAYMENT_VERIFICATION_GRACE_MS,
  };
  const result = await ctx.store.setJSON(ctx.key, record, { onlyIfMatch: current.etag });
  if (!result?.modified) { const e = new Error('Unable to persist the pending checkout safely.'); e.statusCode = 503; throw e; }
}
async function markCheckoutConfirmed(checkout, verified) {
  if (!checkout?.checkoutId) return;
  try {
    const store = await getCheckoutStore();
    const key = `checkout-${String(checkout.checkoutId)}`;
    const current = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    if (!current) return;
    const response = current.data?.response || null;
    const record = {
      ...current.data,
      state: 'confirmed',
      response,
      verified: {
        paymentId: verified?.paymentId || null,
        amount: Number(verified?.amount || checkout.amount || 0),
        confirmedAt: new Date().toISOString(),
      },
      updatedAt: Date.now(),
      expiresAt: Date.now() + PAYMENT_VERIFICATION_GRACE_MS,
    };
    await store.setJSON(key, record, { onlyIfMatch: current.etag });
  } catch (error) {
    // Payment truth lives in Zoho. Blob state is recovery/idempotency metadata only.
    console.warn('Unable to mark durable checkout confirmed', { message: error.message });
  }
}
async function markCheckoutFailed(ctx, message) {
  if (!ctx?.store || !ctx?.key || !ctx?.ownerId) return;
  try {
    const current = await ctx.store.getWithMetadata(ctx.key, { type: 'json', consistency: 'strong' });
    if (!current || String(current.data?.ownerId || '') !== String(ctx.ownerId)) return;
    await ctx.store.setJSON(ctx.key, {
      state: 'failed', fingerprint: ctx.fingerprint, progress: current.data?.progress || ctx.progress || {}, error: cleanText(message, 220), updatedAt: Date.now(), expiresAt: Date.now() - 1,
    }, { onlyIfMatch: current.etag });
  } catch (error) {
    console.warn('Unable to mark checkout attempt failed', { message: error.message });
  }
}
async function acquireStockLock(itemId, ownerId) {
  let store;
  try { store = await getStockLockStore(); } catch (error) { throw checkoutStorageError(error); }
  const key = `item-${String(itemId)}`;
  const now = Date.now();
  const payload = { ownerId: String(ownerId), expiresAt: now + STOCK_LOCK_TTL_MS };
  let result = await store.setJSON(key, payload, { onlyIfNew: true });
  if (result?.modified) return { store, key, ownerId: String(ownerId) };

  let current = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
  if (!current) {
    result = await store.setJSON(key, payload, { onlyIfNew: true });
    if (result?.modified) return { store, key, ownerId: String(ownerId) };
  } else if (Number(current.data?.expiresAt || 0) <= now) {
    result = await store.setJSON(key, payload, { onlyIfMatch: current.etag });
    if (result?.modified) return { store, key, ownerId: String(ownerId) };
  }

  const e = new Error('Another checkout is reserving this flavour right now. Please wait a moment and try again.');
  e.statusCode = 503;
  e.retryAfter = '2';
  throw e;
}
async function renewDistributedLock(lock) {
  if (!lock?.store || !lock?.key || !lock?.ownerId) return lock;
  const current = await lock.store.getWithMetadata(lock.key, { type: 'json', consistency: 'strong' });
  if (!current || String(current.data?.ownerId || '') !== String(lock.ownerId)) {
    const e = new Error('Distributed checkout lock was lost before the transaction completed.'); e.statusCode = 503; e.retryAfter = '2'; throw e;
  }
  const result = await lock.store.setJSON(lock.key, { ownerId: String(lock.ownerId), expiresAt: Date.now() + STOCK_LOCK_TTL_MS }, { onlyIfMatch: current.etag });
  if (!result?.modified) { const e = new Error('Unable to renew the distributed checkout lock.'); e.statusCode = 503; e.retryAfter = '2'; throw e; }
  return lock;
}

async function releaseStockLock(lock) {
  if (!lock?.store || !lock?.key) return;
  try {
    const current = await lock.store.getWithMetadata(lock.key, { type: 'json', consistency: 'strong' });
    if (!current || String(current.data?.ownerId || '') !== String(lock.ownerId)) return;
    await lock.store.setJSON(lock.key, { ownerId: lock.ownerId, expiresAt: Date.now() - 1, released: true }, { onlyIfMatch: current.etag });
  } catch (error) {
    console.warn('Unable to release distributed stock lock', { message: error.message });
  }
}
async function acquireCustomerLock(email, ownerId) {
  let store;
  try { store = await getStockLockStore(); } catch (error) { throw checkoutStorageError(error); }
  const digest = createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex').slice(0, 32);
  const key = `customer-${digest}`;
  const now = Date.now();
  const payload = { ownerId: String(ownerId), expiresAt: now + STOCK_LOCK_TTL_MS };
  let result = await store.setJSON(key, payload, { onlyIfNew: true });
  if (result?.modified) return { store, key, ownerId: String(ownerId) };
  const current = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
  if (current && Number(current.data?.expiresAt || 0) <= now) {
    result = await store.setJSON(key, payload, { onlyIfMatch: current.etag });
    if (result?.modified) return { store, key, ownerId: String(ownerId) };
  }
  const e = new Error('This customer record is being updated by another checkout. Please wait a moment and try again.');
  e.statusCode = 503;
  e.retryAfter = '2';
  throw e;
}

function reservationKey(itemId) { return `item-${String(itemId)}`; }
function activeReservationRows(data, now = Date.now()) {
  return (Array.isArray(data?.reservations) ? data.reservations : []).filter(row =>
    row && row.checkoutId && Number(row.quantity) > 0 && Number(row.expiresAt || 0) > now
  );
}
async function readWebsiteReservations(itemId) {
  const store = await getReservationStore();
  const current = await store.getWithMetadata(reservationKey(itemId), { type: 'json', consistency: 'strong' });
  return { store, current, reservations: activeReservationRows(current?.data) };
}
async function mutateWebsiteReservations(itemId, mutator) {
  const store = await getReservationStore();
  const key = reservationKey(itemId);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    const base = activeReservationRows(current?.data);
    const nextRows = activeReservationRows({ reservations: mutator(base) });
    const payload = { reservations: nextRows, updatedAt: Date.now() };
    const result = current
      ? await store.setJSON(key, payload, { onlyIfMatch: current.etag })
      : await store.setJSON(key, payload, { onlyIfNew: true });
    if (result?.modified) return nextRows;
  }
  const e = new Error('Unable to update the website stock reservation ledger safely.');
  e.statusCode = 503;
  e.service = 'checkout_storage';
  e.retryAfter = '2';
  throw e;
}
async function addWebsiteReservation(order, snapshot, salesOrder) {
  const checkoutId = String(order.checkoutId);
  const row = {
    checkoutId,
    salesOrderId: String(salesOrder?.salesorder_id || ''),
    locationId: String(snapshot?.locationId || ''),
    quantity: Number(order.quantity),
    createdAt: Date.now(),
    expiresAt: Date.now() + WEBSITE_RESERVATION_TTL_MS,
  };
  await mutateWebsiteReservations(order.itemId, rows => {
    const withoutSelf = rows.filter(existing => String(existing.checkoutId) !== checkoutId);
    return [...withoutSelf, row];
  });
  return row;
}
async function releaseWebsiteReservation(itemId, checkoutId) {
  if (!itemId || !checkoutId) return;
  try {
    await mutateWebsiteReservations(itemId, rows => rows.filter(row => String(row.checkoutId) !== String(checkoutId)));
  } catch (error) {
    // A stale reservation is conservative (temporarily reduces sellable stock). Never
    // turn an already-verified payment into a customer-facing failure because cleanup
    // metadata could not be released.
    console.warn('Unable to release website stock reservation', { itemId: String(itemId), checkoutId: String(checkoutId), message: error.message });
  }
}
async function bridgeConfirmedWebsiteReservation(itemId, checkoutId) {
  if (!itemId || !checkoutId) return;
  try {
    const now = Date.now();
    await mutateWebsiteReservations(itemId, rows => rows.map(row =>
      String(row.checkoutId) === String(checkoutId)
        ? { ...row, confirmedAt: now, expiresAt: now + CONFIRMED_RESERVATION_BRIDGE_MS }
        : row
    ));
  } catch (error) {
    // Keep confirmation successful. Failure here can only make the reservation live
    // longer (conservative); Zoho remains the financial source of truth.
    console.warn('Unable to shorten confirmed website stock reservation', { itemId: String(itemId), checkoutId: String(checkoutId), message: error.message });
  }
}
async function applyWebsiteReservationOverlay(snapshot, itemId, currentCheckoutId = '') {
  if (!snapshot || !itemId || !Number.isFinite(Number(snapshot.stock))) return snapshot;
  const { reservations } = await readWebsiteReservations(itemId);
  const locationId = String(snapshot.locationId || '');
  const active = reservations.filter(row =>
    String(row.checkoutId) !== String(currentCheckoutId || '') && String(row.locationId || '') === locationId
  );
  const reserved = active.reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0);
  if (!reserved) return snapshot;

  const reported = Math.max(0, Math.floor(Number(snapshot.stock)));
  const physical = Number.isFinite(Number(snapshot.physicalStock)) ? Math.max(0, Math.floor(Number(snapshot.physicalStock))) : null;
  // Use the more conservative of Zoho's available quantity and physical stock minus
  // website reservations. This bridges eventual visibility of Open Sales Orders
  // without ever increasing Zoho's reported availability.
  const reservationBound = physical === null ? Math.max(0, reported - reserved) : Math.max(0, physical - reserved);
  const effective = Math.max(0, Math.min(reported, reservationBound));
  const requested = Math.max(1, Number(snapshot.requestedQuantity) || 1);
  return {
    ...snapshot,
    stock: effective,
    available: snapshot.available === true && effective > 0,
    canFulfil: snapshot.canFulfil === true && effective >= requested,
    reason: effective >= requested ? snapshot.reason : `Only ${effective} unit(s) are currently available after active website reservations.`,
    websiteReserved: reserved,
  };
}


function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}
function publicError(statusCode, message, requestId, extraHeaders = {}) {
  return json(statusCode, { success: false, message, requestId }, extraHeaders);
}
function requireEnv(name) {
  const value = runtimeEnv(name);
  if (!value || !String(value).trim()) throw new Error(`Missing required server environment variable: ${name}`);
  return String(value).trim();
}
function checkoutSigningSecret() {
  const secret = requireEnv('CHECKOUT_SIGNING_SECRET');
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    const e = new Error('CHECKOUT_SIGNING_SECRET must contain at least 32 bytes of unpredictable server-only data.');
    e.statusCode = 503;
    throw e;
  }
  return secret;
}
function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
function getAccountsUrl() {
  const raw = runtimeEnv("ZOHO_ACCOUNTS_URL") || 'https://accounts.zoho.com';
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !ALLOWED_ACCOUNTS_HOSTS.has(url.hostname)) throw new Error('ZOHO_ACCOUNTS_URL is not approved.');
  return `${url.protocol}//${url.hostname}`;
}
function getExpectedBrowserOrigins(event) {
  const origins = new Set();
  for (const raw of [runtimeEnv("ALLOWED_ORIGIN"), runtimeEnv("URL"), runtimeEnv("DEPLOY_PRIME_URL"), runtimeEnv("DEPLOY_URL")]) {
    if (!raw) continue;
    try { origins.add(new URL(raw).origin); } catch (_) {}
  }
  // A same-origin browser request is also accepted against the actual Netlify/custom
  // domain serving the page. This avoids ALLOWED_ORIGIN drift after a domain/deploy change.
  const host = event.headers?.host || event.headers?.Host;
  if (host && /^[A-Za-z0-9.-]+(?::\d+)?$/.test(host)) origins.add(`https://${host}`);
  return origins;
}
function isAllowedBrowserOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  if (!origin) return true;
  try {
    const normalized = new URL(origin).origin;
    return getExpectedBrowserOrigins(event).has(normalized);
  } catch (_) { return false; }
}
function parseJsonBody(event) {
  if (!event.body) throw new TypeError('Request body is required.');
  if (Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
    const e = new Error('Payload too large.'); e.statusCode = 413; throw e;
  }
  try { return JSON.parse(event.body); } catch { const e = new TypeError('Invalid JSON body.'); e.statusCode = 400; throw e; }
}
function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}
function cleanMultiline(value, maxLength) {
  return typeof value === 'string' ? value.trim().replace(/\r/g, '').slice(0, maxLength) : '';
}
function validateCourierLocker(value) {
  const locker = cleanText(value, 120);
  if (locker.length < 2 || !/^[A-Za-z0-9 ]+$/.test(locker)) {
    throw new TypeError('Courier Locker is required and may contain only letters, numbers and spaces.');
  }
  return locker;
}
function validateCheckoutId(value) {
  const id = cleanText(value, 64);
  if (!/^[A-Za-z0-9-]{16,64}$/.test(id)) throw new TypeError('Invalid checkout request identifier.');
  return id;
}
function validateOrder(input) {
  const customerName = cleanText(input.customerName ?? input.name, 100);
  const email = cleanText(input.email, 100).toLowerCase();
  const mobile = cleanText(input.mobile, 50);
  const addressLine1 = cleanMultiline(input.addressLine1 ?? input.address, 500);
  const addressLine2 = cleanText(input.addressLine2, 255);
  const city = cleanText(input.city, 100);
  const province = cleanText(input.province ?? input.state, 100);
  const postalCode = cleanText(input.postalCode ?? input.zip, 50);
  const country = cleanText(input.country, 100) || 'South Africa';
  const courierLocker = validateCourierLocker(input.courierLocker);
  const checkoutId = validateCheckoutId(input.checkoutId);
  const flavour = cleanText(input.flavour, 100);
  const requestedItemId = cleanText(input.itemId, 40);
  const itemId = /^\d+$/.test(requestedItemId) ? requestedItemId : '';
  const quantity = Number(input.quantity);
  const submittedAmount = Number(input.amount);

  if (customerName.length < 2) throw new TypeError('A valid customer name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TypeError('A valid email address is required.');
  if (!/^[+()\d\s.-]{7,50}$/.test(mobile) || (mobile.match(/\d/g) || []).length < 7) throw new TypeError('A valid mobile number is required.');
  if (addressLine1.length < 3) throw new TypeError('A valid billing street address is required.');
  if (city.length < 2 || province.length < 2 || postalCode.length < 3 || country.length < 2) throw new TypeError('A complete billing/contact address is required.');
  if (!ALLOWED_FLAVOURS.has(flavour)) throw new TypeError('A valid BC10000 flavour is required.');
  if (!itemId) throw new TypeError('A verified Zoho item identifier is required. Please reload the shop and select a flavour again.');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new TypeError('Quantity must be between 1 and 5.');

  const amount = quantity * PRODUCT_PRICE_ZAR + DELIVERY_PRICE_ZAR;
  if (!Number.isFinite(submittedAmount) || Math.abs(submittedAmount - amount) > PAYMENT_EPSILON) {
    const e = new TypeError('The submitted total does not match server pricing.'); e.statusCode = 400; throw e;
  }
  return { customerName, email, mobile, addressLine1, addressLine2, city, province, postalCode, country, courierLocker, checkoutId, flavour, itemId, quantity, amount };
}
function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts.shift() || fullName, lastName: parts.join(' ') };
}
function buildBillingAddress(order) {
  return { attention: order.customerName, address: order.addressLine1, street2: order.addressLine2, city: order.city, state: order.province, zip: order.postalCode, country: order.country, phone: order.mobile };
}
function buildPrimaryPerson(order, contactPersonId) {
  const { firstName, lastName } = splitName(order.customerName);
  return { ...(contactPersonId ? { contact_person_id: String(contactPersonId) } : {}), first_name: firstName, last_name: lastName, email: order.email, phone: order.mobile, mobile: order.mobile, is_primary_contact: true };
}
async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); } finally { clearTimeout(timeout); }
}
async function withZohoSlot(work) {
  const started = Date.now();
  // Queue briefly instead of rejecting a legitimate checkout merely because another
  // request in the same warm function instance is using one of our conservative
  // Zoho API slots. This still keeps us below Zoho's organization concurrency cap.
  while (activeZohoRequests >= MAX_LOCAL_ZOHO_CONCURRENCY) {
    if (Date.now() - started >= LOCAL_ZOHO_QUEUE_WAIT_MS) {
      const e = new Error('Zoho request queue is temporarily busy.'); e.statusCode = 503; e.retryAfter = '2'; throw e;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  activeZohoRequests += 1;
  try { return await work(); } finally { activeZohoRequests -= 1; }
}
async function refreshAccessToken() {
  const form = new URLSearchParams({ refresh_token: requireEnv('ZOHO_REFRESH_TOKEN'), client_id: requireEnv('ZOHO_CLIENT_ID'), client_secret: requireEnv('ZOHO_CLIENT_SECRET'), grant_type: 'refresh_token' });
  const response = await fetchWithTimeout(`${getAccountsUrl()}/oauth/v2/token`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  let data = {}; try { data = await response.json(); } catch (_) {}
  if (!response.ok || !data.access_token || !data.api_domain) { console.error('Zoho OAuth refresh failed', { status: response.status, error: data.error || 'unknown' }); throw new Error('Zoho OAuth authentication failed.'); }
  const apiUrl = new URL(data.api_domain);
  if (apiUrl.protocol !== 'https:' || !ALLOWED_API_HOSTS.has(apiUrl.hostname)) throw new Error('Zoho returned an unapproved API domain.');
  const expiresIn = Number(data.expires_in) > 600 ? Number(data.expires_in) : 3600;
  cachedAccessToken = data.access_token;
  cachedApiDomain = `${apiUrl.protocol}//${apiUrl.hostname}`;
  accessTokenExpiresAt = Date.now() + Math.max(60, expiresIn - 300) * 1000;
  return { accessToken: cachedAccessToken, apiDomain: cachedApiDomain };
}
async function getAccessToken() {
  if (cachedAccessToken && cachedApiDomain && Date.now() < accessTokenExpiresAt) return { accessToken: cachedAccessToken, apiDomain: cachedApiDomain };
  if (!tokenRefreshPromise) tokenRefreshPromise = refreshAccessToken().finally(() => { tokenRefreshPromise = null; });
  return tokenRefreshPromise;
}
function clearCachedAccessToken() {
  cachedAccessToken = null;
  cachedApiDomain = null;
  accessTokenExpiresAt = 0;
}
async function zohoRequest(path, { method = 'GET', body } = {}) {
  return withZohoSlot(async () => {
    const normalizedMethod = String(method || 'GET').toUpperCase();
    const maxAttempts = normalizedMethod === 'GET' ? 3 : 2;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const { accessToken, apiDomain } = await getAccessToken();
      const response = await fetchWithTimeout(`${apiDomain}/books/${BOOKS_API_VERSION}${path}`, { method: normalizedMethod, headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      let data = {}; try { data = await response.json(); } catch (_) {}
      if (response.status === 401 && attempt === 0) {
        clearCachedAccessToken();
        continue;
      }
      const transient = response.status === 429 || [502, 503, 504].includes(response.status);
      // Only repeat GETs automatically. Repeating a financial POST after a lost
      // response can duplicate a transaction; prepare_order instead recovers by its
      // deterministic WEB-<checkoutId> reference and durable checkout record.
      if (transient && normalizedMethod === 'GET' && attempt < maxAttempts - 1) {
        const retryAfterSeconds = Number(response.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? Math.min(3000, retryAfterSeconds * 1000)
          : TRANSIENT_GET_RETRY_MS * (attempt + 1);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      if (response.status === 429) { const e = new Error('Zoho rate/concurrency limit reached.'); e.statusCode = 503; e.retryAfter = response.headers.get('retry-after') || '2'; throw e; }
      if (!response.ok || data.code !== 0) {
        console.error('Zoho Books API request failed', { status: response.status, code: data.code, method: normalizedMethod });
        const e = new Error('Zoho Books API request failed.');
        e.statusCode = response.status >= 500 ? 503 : 502;
        // TEMPORARY TEST-BRANCH DIAGNOSTICS: numeric upstream metadata only.
        // Never attach response bodies, tokens, headers, credentials, or authorization data.
        e.zohoHttpStatus = Number(response.status) || null;
        e.zohoApiCode = (typeof data.code === 'number' || typeof data.code === 'string') ? String(data.code) : null;
        throw e;
      }
      return data;
    }
    const e = new Error('Zoho authentication could not be refreshed.'); e.statusCode = 503; throw e;
  });
}
async function zohoPdf(path) {
  return withZohoSlot(async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { accessToken, apiDomain } = await getAccessToken();
      const response = await fetchWithTimeout(`${apiDomain}/books/${BOOKS_API_VERSION}${path}`, { method: 'GET', headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, Accept: 'application/pdf' } });
      if (response.status === 401 && attempt === 0) { clearCachedAccessToken(); continue; }
      if (!response.ok) { const e = new Error('Unable to retrieve Zoho payment receipt.'); e.statusCode = response.status >= 500 ? 503 : 502; throw e; }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.slice(0, 4).toString('ascii') !== '%PDF') { const e = new Error('Zoho did not return a valid receipt PDF.'); e.statusCode = 502; throw e; }
      return bytes;
    }
    const e = new Error('Zoho authentication could not be refreshed.'); e.statusCode = 503; throw e;
  });
}
function organizationQuery(extra = {}) {
  const params = new URLSearchParams({ organization_id: requireEnv('ZOHO_ORGANIZATION_ID'), ...extra });
  return params.toString();
}
function asFiniteStock(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}
function firstFiniteStock(...values) {
  for (const value of values) {
    const n = asFiniteStock(value);
    if (n !== null) return n;
  }
  return null;
}
function explicitItemAvailableStock(item) {
  return firstFiniteStock(item?.available_stock, item?.actual_available_stock);
}
function locationStockReading(location, item = null) {
  for (const field of ['location_available_stock', 'location_actual_available_stock']) {
    const value = asFiniteStock(location?.[field]);
    if (value !== null) return { value, source: field, explicit: true };
  }
  const physical = asFiniteStock(location?.location_stock_on_hand);
  if (physical !== null) {
    const aggregateAvailable = explicitItemAvailableStock(item);
    if (aggregateAvailable !== null) {
      return { value: Math.min(physical, aggregateAvailable), source: 'location_stock_on_hand_capped_by_item_available', explicit: false };
    }
    return { value: physical, source: 'location_stock_on_hand', explicit: false };
  }
  return { value: null, source: null, explicit: false };
}
function locationAvailableStock(location, item = null) {
  return locationStockReading(location, item).value;
}
function locationPhysicalStock(location) {
  return firstFiniteStock(
    location?.location_stock_on_hand,
    location?.location_actual_available_stock,
    location?.location_available_stock
  );
}
function collectStockSignals(item, locationId = '') {
  const signals = {};
  const locations = Array.isArray(item?.locations) ? item.locations : [];
  const location = locationId ? locations.find(l => String(l?.location_id || '') === String(locationId)) : null;
  const source = location || (locations.length === 1 ? locations[0] : null);
  if (source) {
    for (const field of ['location_available_stock', 'location_actual_available_stock', 'location_stock_on_hand']) {
      const value = asFiniteStock(source[field]);
      if (value !== null) signals[field] = value;
    }
  }
  for (const field of ['available_stock', 'actual_available_stock', 'stock_on_hand']) {
    const value = asFiniteStock(item?.[field]);
    if (value !== null) signals[`item_${field}`] = value;
  }
  return signals;
}
function chooseStockLocation(item, requestedQuantity = 1) {
  const configuredLocationId = String(runtimeEnv(STOCK_LOCATION_ID_ENV) || '').trim();
  const locations = (Array.isArray(item?.locations) ? item.locations : [])
    .filter(location => String(location?.status || 'active').toLowerCase() !== 'inactive');

  const activeLocations = locations.map(location => {
    const reading = locationStockReading(location, item);
    return {
      location,
      locationId: String(location?.location_id || ''),
      available: reading.value,
      stockSource: reading.source,
      explicitAvailable: reading.explicit === true,
      physical: locationPhysicalStock(location),
      isPrimary: location?.is_primary === true,
    };
  }).filter(entry => entry.locationId && entry.available !== null);

  if (configuredLocationId) {
    const configured = activeLocations.find(entry => entry.locationId === configuredLocationId);
    if (!configured) {
      const e = new Error('The configured Zoho stock location is not present on this item.');
      e.statusCode = 409;
      throw e;
    }
    return configured;
  }

  if (activeLocations.length) {
    if (activeLocations.length > 1 && activeLocations.every(entry => !entry.explicitAvailable)) {
      const primary = activeLocations.find(entry => entry.isPrimary);
      if (!primary) {
        const e = new Error('Multiple Zoho stock locations are ambiguous. Configure ZOHO_LOCATION_ID for website orders.');
        e.statusCode = 409;
        throw e;
      }
      return primary;
    }
    const qty = Math.max(1, Number(requestedQuantity) || 1);
    const fulfillable = activeLocations.filter(entry => Number(entry.available) >= qty);
    const pool = fulfillable.length ? fulfillable : activeLocations;
    pool.sort((a, b) => {
      const stockDiff = Number(b.available) - Number(a.available);
      if (stockDiff !== 0) return stockDiff;
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return 0;
    });
    return pool[0];
  }

  let available = null, stockSource = null;
  for (const field of ['available_stock', 'actual_available_stock', 'stock_on_hand']) {
    const value = asFiniteStock(item?.[field]);
    if (value !== null) { available = value; stockSource = `item_${field}`; break; }
  }
  const physical = firstFiniteStock(item?.stock_on_hand, item?.actual_available_stock, item?.available_stock);
  return { location: null, locationId: '', available, stockSource, physical, isPrimary: false, explicitAvailable: stockSource !== 'item_stock_on_hand' };
}
function availableStock(item, requestedQuantity = 1) {
  return chooseStockLocation(item, requestedQuantity).available;
}
function normalizeItemName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
function flavourTokens(flavour) {
  return normalizeItemName(flavour).split(' ').filter(Boolean);
}
function itemMatchScore(item, flavour) {
  const n = normalizeItemName(item?.name);
  if (!n) return -1;
  const expected = normalizeItemName(PRODUCT_NAMES[flavour]);
  const plainFlavour = normalizeItemName(flavour);
  if (n === expected) return 100;
  if (n === plainFlavour) return 95;
  const tokens = flavourTokens(flavour);
  if (!tokens.every(t => n.includes(t))) return -1;
  let score = 60;
  if (n.includes('bc10000')) score += 25;
  if (n.includes('elfbar')) score += 10;
  if (String(item.status || '').toLowerCase() === 'active') score += 2;
  if (Math.abs(Number(item.rate) - PRODUCT_PRICE_ZAR) <= PAYMENT_EPSILON) score += 3;
  return score;
}
async function getItemById(itemId) {
  const data = await zohoRequest(`/items/${encodeURIComponent(String(itemId))}?${organizationQuery()}`);
  return data.item || null;
}
async function listItems(query = {}) {
  const all = [];
  let page = 1;
  do {
    const data = await zohoRequest(`/items?${organizationQuery({ ...query, page: String(page), per_page: '200' })}`);
    if (Array.isArray(data.items)) all.push(...data.items);
    if (!data.page_context?.has_more_page) break;
    page += 1;
    if (page > 10) break;
  } while (true);
  return all;
}
async function getItemsByIds(itemIds) {
  const ids = [...new Set((itemIds || []).map(String).filter(id => /^\d+$/.test(id)))];
  if (!ids.length) return [];
  try {
    const data = await zohoRequest(`/itemdetails?${organizationQuery({ item_ids: ids.join(',') })}`);
    return Array.isArray(data.items) ? data.items : [];
  } catch (_) {
    // Compatibility fallback if an organization/account variant does not expose bulk details.
    // Keep this sequential so it cannot trip our own local Zoho concurrency guard.
    const items = [];
    for (const id of ids) items.push(await getItemById(id));
    return items;
  }
}
async function findExactItemByName(name) {
  // `name` is a documented Zoho Books Items filter. Status is validated locally.
  const items = await listItems({ name });
  const target = normalizeItemName(name);
  const exact = items.filter(i => normalizeItemName(i.name) === target && String(i.status || '').toLowerCase() === 'active');
  if (exact.length !== 1) { const e = new Error(exact.length ? `Multiple active Zoho items are named “${name}”.` : `Active Zoho item “${name}” was not found.`); e.statusCode = 409; throw e; }
  const item = exact[0];
  return item.item_id ? (await getItemById(item.item_id)) || item : item;
}
async function discoverProductCatalog(force = false) {
  const allResolved = Object.keys(PRODUCT_NAMES).every(f => resolvedProductItemIds.has(f));
  if (!force && allResolved && Date.now() < cachedProductCatalogUntil) return;

  // Environment-pinned IDs are authoritative. They are verified against the flavour identity.
  for (const flavour of Object.keys(PRODUCT_NAMES)) {
    const envName = PRODUCT_ITEM_ID_ENVS[flavour];
    const configuredId = envName ? String(runtimeEnv(envName) || '').trim() : '';
    if (!configuredId) continue;
    const item = await getItemById(configuredId);
    if (!item || itemMatchScore(item, flavour) < 60) {
      const e = new Error(`Configured Zoho item ID for ${flavour} does not match that BC10000 flavour.`); e.statusCode = 409; throw e;
    }
    resolvedProductItemIds.set(flavour, String(item.item_id));
  }

  const unresolved = Object.keys(PRODUCT_NAMES).filter(f => !resolvedProductItemIds.has(f));
  if (!unresolved.length) { cachedProductCatalogUntil = Date.now() + PRODUCT_CATALOG_CACHE_MS; return; }

  // First use a narrow catalogue request. If names were shortened in Zoho, fall back to all active items.
  let candidates = (await listItems({ name_contains: 'BC10000' })).filter(item => String(item.status || '').toLowerCase() === 'active');
  if (!candidates.length || unresolved.some(flavour => !candidates.some(item => itemMatchScore(item, flavour) >= 60))) {
    const allActive = (await listItems()).filter(item => String(item.status || '').toLowerCase() === 'active');
    const seen = new Set(candidates.map(i => String(i.item_id)));
    for (const item of allActive) if (!seen.has(String(item.item_id))) candidates.push(item);
  }

  for (const flavour of unresolved) {
    const ranked = candidates
      .map(item => ({ item, score: itemMatchScore(item, flavour) }))
      .filter(x => x.score >= 60)
      .sort((a, b) => b.score - a.score);
    if (!ranked.length) continue;
    if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
      const e = new Error(`Multiple Zoho items could represent ${flavour}. Pin the correct item ID in Netlify.`); e.statusCode = 409; throw e;
    }
    resolvedProductItemIds.set(flavour, String(ranked[0].item.item_id));
  }
  cachedProductCatalogUntil = Date.now() + PRODUCT_CATALOG_CACHE_MS;
}
async function resolveProductItem(flavour, forceDiscovery = false) {
  if (!PRODUCT_NAMES[flavour]) { const e = new Error('Unknown BC10000 flavour.'); e.statusCode = 400; throw e; }
  await discoverProductCatalog(forceDiscovery);
  const itemId = resolvedProductItemIds.get(flavour);
  if (!itemId) {
    // Last-resort exact queries cover organizations where search_text behaves differently.
    for (const name of [PRODUCT_NAMES[flavour], flavour]) {
      try {
        const item = await findExactItemByName(name);
        if (item?.item_id && itemMatchScore(item, flavour) >= 60) {
          resolvedProductItemIds.set(flavour, String(item.item_id));
          return item;
        }
      } catch (_) {}
    }
    const e = new Error(`No active Zoho Books Item could be mapped to ${flavour}.`); e.statusCode = 409; throw e;
  }
  let item = null;
  try {
    item = await getItemById(itemId);
  } catch (error) {
    // A product can be deleted/recreated or an old warm instance can retain a stale
    // item_id. In that case discard the mapping and rediscover the catalogue once.
    resolvedProductItemIds.delete(flavour);
    cachedProductCatalogUntil = 0;
    if (!forceDiscovery) return resolveProductItem(flavour, true);
    throw error;
  }
  if (!item || itemMatchScore(item, flavour) < 60) {
    resolvedProductItemIds.delete(flavour);
    cachedProductCatalogUntil = 0;
    if (!forceDiscovery) return resolveProductItem(flavour, true);
    const e = new Error(`Zoho item mapping for ${flavour} is no longer valid.`); e.statusCode = 409; throw e;
  }
  return item;
}
async function getProductAvailability(forceStockRefresh = false, forceCatalogRefresh = false) {
  if (!forceStockRefresh && cachedAvailability && Date.now() < cachedAvailabilityUntil) return cachedAvailability;
  if (forceCatalogRefresh) cachedProductCatalogUntil = 0;
  try { await discoverProductCatalog(forceCatalogRefresh); } catch (error) {
    console.error('Zoho BC10000 catalogue discovery failed', { message: error.message });
  }

  // Fetch all five resolved products in one Zoho call where supported. This reduces
  // API usage and, more importantly, ensures the product list is built from one
  // coherent stock snapshot rather than five independent calls.
  const flavours = Object.keys(PRODUCT_NAMES);
  const resolvedIds = flavours.map(f => resolvedProductItemIds.get(f)).filter(Boolean);
  let detailedItems = [];
  try { detailedItems = await getItemsByIds(resolvedIds); } catch (error) {
    console.error('Zoho bulk item detail lookup failed', { message: error.message });
  }
  const byId = new Map(detailedItems.filter(Boolean).map(item => [String(item.item_id || ''), item]));

  const result = {};
  for (const flavour of flavours) {
    try {
      const mappedId = resolvedProductItemIds.get(flavour);
      let item = mappedId ? byId.get(String(mappedId)) : null;
      if (!item) item = await resolveProductItem(flavour, false);
      if (!item?.item_id || itemMatchScore(item, flavour) < 60) throw Object.assign(new Error(`Zoho item mapping for ${flavour} could not be verified.`), { statusCode: 409 });
      resolvedProductItemIds.set(flavour, String(item.item_id));
      let snapshot = buildStockSnapshot(flavour, item, 1);
      // Some Zoho account/API variants return a lighter object from /itemdetails.
      // If stock fields are absent, fall back to the authoritative single-item GET.
      if (snapshot.reason === 'Stock quantity is not configured in Zoho Books') {
        const fullItem = await getItemById(item.item_id);
        if (fullItem) { item = fullItem; snapshot = buildStockSnapshot(flavour, item, 1); }
      }
      result[flavour] = {
        available: snapshot.available,
        stock: snapshot.stock,
        reason: snapshot.reason || (snapshot.available ? null : 'Out of stock'),
        itemId: snapshot.itemId,
        itemName: snapshot.itemName,
        price: snapshot.price,
        locationId: snapshot.locationId,
        locationName: snapshot.locationName,
        stockSource: snapshot.stockSource || null,
      };
    } catch (error) {
      result[flavour] = { available: false, stock: 0, reason: error.statusCode === 409 ? error.message : 'Zoho stock lookup failed', itemId: resolvedProductItemIds.get(flavour) || null, itemName: null, price: null };
    }
  }
  const states = Object.values(result);
  const infrastructureFailures = states.filter(state => state.reason === 'Zoho stock lookup failed').length;
  if (states.length && infrastructureFailures === states.length) {
    const e = new Error('Live Zoho stock could not be read.'); e.statusCode = 503; e.retryAfter = '2'; throw e;
  }
  cachedAvailability = result;
  cachedAvailabilityUntil = Date.now() + AVAILABILITY_CACHE_MS;
  return result;
}

function buildStockSnapshot(flavour, item, quantity = 1) {
  const requestedQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0 ? Number(quantity) : 1;
  let locationState;
  try {
    locationState = chooseStockLocation(item, requestedQuantity);
  } catch (error) {
    return {
      flavour,
      itemId: item?.item_id ? String(item.item_id) : null,
      itemName: item?.name || null,
      available: false,
      canFulfil: false,
      stock: 0,
      physicalStock: null,
      stockSignals: {},
      stockSource: null,
      requestedQuantity,
      price: Number(item?.rate),
      locationId: null,
      locationName: null,
      reason: error.message,
    };
  }
  const stock = locationState.available;
  const active = String(item?.status || '').toLowerCase() === 'active';
  const priceMatches = Math.abs(Number(item?.rate) - PRODUCT_PRICE_ZAR) <= PAYMENT_EPSILON;
  const configured = stock !== null;
  const wholeStock = configured ? Math.max(0, Math.floor(stock)) : 0;
  const physicalStock = locationState.physical === null ? null : Math.max(0, Math.floor(Number(locationState.physical)));
  let reason = null;
  if (!active) reason = 'Item inactive in Zoho Books';
  else if (!priceMatches) reason = 'Zoho item price does not match R300.00';
  else if (!configured) reason = 'Stock quantity is not configured in Zoho Books';
  else if (wholeStock < requestedQuantity) reason = `Only ${wholeStock} unit(s) are currently available.`;
  return {
    flavour,
    itemId: item?.item_id ? String(item.item_id) : null,
    itemName: item?.name || null,
    available: active && priceMatches && configured && wholeStock > 0,
    canFulfil: active && priceMatches && configured && wholeStock >= requestedQuantity,
    stock: wholeStock,
    physicalStock,
    stockSignals: collectStockSignals(item, locationState.locationId || ''),
    stockSource: locationState.stockSource || null,
    requestedQuantity,
    price: Number(item?.rate),
    locationId: locationState.locationId || null,
    locationName: locationState.location?.location_name || null,
    reason,
  };
}
async function resolveSelectedProductItem(flavour, expectedItemId = '', forceFresh = false) {
  const supplied = String(expectedItemId || '').trim();
  if (supplied) {
    if (!/^\d+$/.test(supplied)) { const e = new TypeError('Invalid Zoho item identifier.'); e.statusCode = 400; throw e; }
    let item = null;
    try {
      item = await getItemById(supplied);
    } catch (error) {
      // A browser can hold an item_id from a page that was opened before the Zoho
      // Item was deleted/recreated. Treat that as a stock/catalogue conflict rather
      // than an infrastructure failure so the UI refreshes all five products.
      const e = new Error('The selected Zoho Books Item no longer exists. Please refresh the shop stock and select the flavour again.');
      e.statusCode = 409;
      e.freshAvailabilityNeeded = true;
      throw e;
    }
    if (!item || itemMatchScore(item, flavour) < 60) {
      const e = new Error('The selected product no longer matches the Zoho Books item catalogue. Please refresh the shop.'); e.statusCode = 409; throw e;
    }
    resolvedProductItemIds.set(flavour, String(item.item_id));
    return item;
  }
  return resolveProductItem(flavour, forceFresh);
}
async function checkExactStock(flavour, quantity, forceFresh = false, expectedItemId = '') {
  if (!ALLOWED_FLAVOURS.has(flavour)) { const e = new TypeError('A valid BC10000 flavour is required.'); e.statusCode = 400; throw e; }
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) { const e = new TypeError('Quantity must be between 1 and 5.'); e.statusCode = 400; throw e; }
  if (forceFresh) cachedAvailabilityUntil = 0;
  let item = await resolveSelectedProductItem(flavour, expectedItemId, forceFresh);
  let snapshot = buildStockSnapshot(flavour, item, qty);
  if ((!snapshot.itemId || snapshot.reason === 'Stock quantity is not configured in Zoho Books') && !expectedItemId && !forceFresh) {
    item = await resolveProductItem(flavour, true);
    snapshot = buildStockSnapshot(flavour, item, qty);
  }
  return { item, snapshot };
}
async function requireStockState(flavour, quantity, expectedItemId = '') {
  const { item, snapshot } = await checkExactStock(flavour, quantity, true, expectedItemId);
  if (!snapshot.canFulfil) {
    const detail = snapshot.reason || 'This product is not currently available.';
    const message = snapshot.stock === 0
      ? 'This flavour has just been purchased by another customer and is now out of stock.'
      : (Number(snapshot.stock) < Number(quantity)
          ? `Only ${snapshot.stock} unit(s) remain after a recent purchase. Please lower the quantity or choose another flavour.`
          : detail);
    const e = new Error(message);
    e.statusCode = 409;
    e.freshAvailabilityNeeded = true;
    throw e;
  }
  return { item, snapshot };
}
async function requireStock(flavour, quantity, expectedItemId = '') {
  return (await requireStockState(flavour, quantity, expectedItemId)).item;
}

async function requireNonNegativeStockAfterCommit(flavour, expectedItemId = '', orderedQty = 1) {
  const item = await resolveSelectedProductItem(flavour, expectedItemId, true);
  const stock = availableStock(item);
  // After the Sales Order is Open, Zoho should reflect committed demand.
  // Negative available stock means two buyers crossed the last units — void this order.
  if (stock === null || stock < 0) {
    const e = new Error('Another customer completed a purchase of this flavour at the same time. Your pending order was cancelled so stock stays accurate. Please choose a different quantity or flavour.');
    e.statusCode = 409;
    e.freshAvailabilityNeeded = true;
    throw e;
  }
  return item;
}
async function requireDeliveryItem() {
  if (cachedDeliveryItem && Date.now() < cachedDeliveryItemUntil) return cachedDeliveryItem;
  const configuredId = String(runtimeEnv(DELIVERY_ITEM_ID_ENV) || '').trim();
  const item = configuredId ? await getItemById(configuredId) : await findExactItemByName(DELIVERY_ITEM_NAME);
  if (!item || normalizeItemName(item.name) !== normalizeItemName(DELIVERY_ITEM_NAME)) { const e = new Error('The configured Courier Guy delivery item does not match the expected Zoho Books item.'); e.statusCode = 409; throw e; }
  if (item.status !== 'active') { const e = new Error('The Courier Guy delivery item is inactive in Zoho Books.'); e.statusCode = 409; throw e; }
  if (Math.abs(Number(item.rate) - DELIVERY_PRICE_ZAR) > PAYMENT_EPSILON) { const e = new Error('The Zoho delivery price does not match R60.00.'); e.statusCode = 409; throw e; }
  cachedDeliveryItem = item;
  cachedDeliveryItemUntil = Date.now() + 5 * 60 * 1000;
  return item;
}
async function findCustomerByEmail(email) {
  const data = await zohoRequest(`/contacts?${organizationQuery({ contact_type: 'customer', email, per_page: '2' })}`);
  const contacts = Array.isArray(data.contacts) ? data.contacts : [];
  const exact = contacts.filter(c => String(c.email || '').trim().toLowerCase() === email);
  if (exact.length > 1) { const e = new Error('Multiple Zoho customers use this email. Resolve duplicates in Zoho Books.'); e.statusCode = 409; throw e; }
  return exact[0] || null;
}
async function createCustomer(order) {
  const data = await zohoRequest(`/contacts?${organizationQuery()}`, { method: 'POST', body: { contact_name: order.customerName, contact_type: 'customer', billing_address: buildBillingAddress(order), contact_persons: [buildPrimaryPerson(order)] } });
  return data.contact;
}
async function updateCustomer(existing, order) {
  const contactId = String(existing.contact_id || '');
  const currentData = await zohoRequest(`/contacts/${encodeURIComponent(contactId)}?${organizationQuery()}`);
  const current = currentData.contact || {};
  const persons = Array.isArray(current.contact_persons) ? current.contact_persons : [];
  const primary = persons.find(p => p.is_primary_contact) || persons.find(p => String(p.email || '').trim().toLowerCase() === order.email) || null;
  const preserved = persons.filter(p => String(p.contact_person_id || '') !== String(primary?.contact_person_id || '')).map(p => ({ contact_person_id: p.contact_person_id, first_name: p.first_name || '', last_name: p.last_name || '', email: p.email || '', phone: p.phone || '', mobile: p.mobile || '', is_primary_contact: false }));
  const body = { contact_name: order.customerName, contact_type: 'customer', billing_address: buildBillingAddress(order), contact_persons: [buildPrimaryPerson(order, primary?.contact_person_id), ...preserved] };
  if (current.shipping_address) body.shipping_address = current.shipping_address;
  const data = await zohoRequest(`/contacts/${encodeURIComponent(contactId)}?${organizationQuery()}`, { method: 'PUT', body });
  return data.contact || current;
}
async function syncCustomer(order) {
  const existing = await findCustomerByEmail(order.email);
  return existing ? updateCustomer(existing, order) : createCustomer(order);
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function futureDateISO(days) { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function webReference(checkoutId) { return `WEB-${checkoutId}`.slice(0, 100); }
async function getSalesOrderById(salesOrderId) {
  const data = await zohoRequest(`/salesorders/${encodeURIComponent(String(salesOrderId))}?${organizationQuery()}`);
  const value = data.salesorder;
  return Array.isArray(value) ? (value[0] || null) : (value || null);
}
function isVoidedStatus(status) {
  return ['void', 'voided', 'cancelled', 'canceled'].includes(String(status || '').toLowerCase());
}
function assertSalesOrderMatches(salesOrder, order, customer, deliveryItem) {
  if (!salesOrder?.salesorder_id) { const e = new Error('Recovered Zoho Sales Order is incomplete.'); e.statusCode = 409; throw e; }
  if (String(salesOrder.reference_number || '') !== webReference(order.checkoutId)) { const e = new Error('Recovered Sales Order reference does not match this checkout.'); e.statusCode = 409; throw e; }
  if (customer?.contact_id && String(salesOrder.customer_id || '') !== String(customer.contact_id)) { const e = new Error('Recovered Sales Order belongs to a different customer. Manual review is required.'); e.statusCode = 409; throw e; }
  const lines = Array.isArray(salesOrder.line_items) ? salesOrder.line_items : [];
  const productLines = lines.filter(line => String(line.item_id || '') === String(order.itemId));
  if (productLines.length !== 1 || Math.abs(Number(productLines[0].quantity) - Number(order.quantity)) > PAYMENT_EPSILON || Math.abs(Number(productLines[0].rate) - PRODUCT_PRICE_ZAR) > PAYMENT_EPSILON) {
    const e = new Error('Recovered Sales Order product details do not match this checkout. Manual review is required.'); e.statusCode = 409; throw e;
  }
  if (deliveryItem?.item_id) {
    const deliveryLines = lines.filter(line => String(line.item_id || '') === String(deliveryItem.item_id));
    if (deliveryLines.length !== 1 || Math.abs(Number(deliveryLines[0].quantity) - 1) > PAYMENT_EPSILON || Math.abs(Number(deliveryLines[0].rate) - DELIVERY_PRICE_ZAR) > PAYMENT_EPSILON) {
      const e = new Error('Recovered Sales Order delivery charge does not match this checkout. Manual review is required.'); e.statusCode = 409; throw e;
    }
  }
  return salesOrder;
}
async function findRecoverableSalesOrder(order, customer, deliveryItem, progress = {}) {
  if (progress.salesOrderId) {
    try {
      const byId = await getSalesOrderById(progress.salesOrderId);
      if (byId && !isVoidedStatus(byId.status)) return assertSalesOrderMatches(byId, order, customer, deliveryItem);
    } catch (error) {
      if (error.statusCode === 409) throw error;
      // Fall through to deterministic-reference recovery if a checkpoint became stale.
    }
  }
  const reference = webReference(order.checkoutId);
  const data = await zohoRequest(`/salesorders?${organizationQuery({ reference_number: reference, per_page: '20' })}`);
  const summaries = (Array.isArray(data.salesorders) ? data.salesorders : [])
    .filter(s => String(s.reference_number || '') === reference && !isVoidedStatus(s.status));
  if (summaries.length > 1) { const e = new Error('Multiple active Zoho Sales Orders exist for this checkout reference. Manual review is required.'); e.statusCode = 409; throw e; }
  if (!summaries.length) return null;
  const full = await getSalesOrderById(summaries[0].salesorder_id);
  return assertSalesOrderMatches(full, order, customer, deliveryItem);
}
async function findRecoverableInvoice(salesOrder, customerId, reference, progress = {}) {
  if (progress.invoiceId) {
    try {
      const invoice = await getInvoice(progress.invoiceId);
      if (invoice?.invoice_id && !isVoidedStatus(invoice.status)) {
        if (String(invoice.salesorder_id || '') !== String(salesOrder.salesorder_id)) { const e = new Error('Recovered invoice is linked to a different Sales Order. Manual review is required.'); e.statusCode = 409; throw e; }
        return invoice;
      }
    } catch (error) {
      if (error.statusCode === 409) throw error;
    }
  }
  // Recovery path for the narrow crash window after Zoho created the invoice but
  // before the durable checkpoint was written. Search the customer's recent invoices
  // and require the exact Sales Order relationship/reference before reuse.
  const data = await zohoRequest(`/invoices?${organizationQuery({ customer_id: String(customerId), per_page: '100' })}`);
  const matches = (Array.isArray(data.invoices) ? data.invoices : []).filter(inv =>
    String(inv.salesorder_id || '') === String(salesOrder.salesorder_id) &&
    !isVoidedStatus(inv.status) &&
    (!inv.reference_number || String(inv.reference_number) === String(reference))
  );
  if (matches.length > 1) { const e = new Error('Multiple active Zoho invoices are linked to this website Sales Order. Manual review is required.'); e.statusCode = 409; throw e; }
  if (!matches.length) return null;
  return getInvoice(matches[0].invoice_id);
}
async function createSalesOrder(order, customer, productItem, deliveryItem, reference, stockSnapshot) {
  const locationId = String(stockSnapshot?.locationId || '').trim();
  const productLine = { item_id: String(productItem.item_id), rate: PRODUCT_PRICE_ZAR, quantity: order.quantity };
  if (locationId) productLine.location_id = locationId;
  const payload = {
    customer_id: String(customer.contact_id),
    date: todayISO(),
    reference_number: reference,
    delivery_method: 'Courier Guy Locker-to-Locker',
    ...(locationId ? { location_id: locationId } : {}),
    line_items: [
      productLine,
      { item_id: String(deliveryItem.item_id), rate: DELIVERY_PRICE_ZAR, quantity: 1 },
    ],
    notes: `Vestige website checkout. Courier Locker: ${order.courierLocker}. Selected flavour: ${order.flavour}. Full online payment is mandatory before confirmation.`,
  };
  const data = await zohoRequest(`/salesorders?${organizationQuery()}`, { method: 'POST', body: payload });
  return data.salesorder;
}
async function ensureSalesOrderOpen(salesOrder) {
  if (!salesOrder?.salesorder_id) return salesOrder;
  const status = String(salesOrder.status || '').toLowerCase();
  if (['open', 'invoiced', 'partially_invoiced'].includes(status)) return salesOrder;
  if (status && status !== 'draft') { const e = new Error(`Zoho Sales Order entered unexpected status: ${status}.`); e.statusCode = 409; throw e; }
  await zohoRequest(`/salesorders/${encodeURIComponent(salesOrder.salesorder_id)}/status/open?${organizationQuery()}`, { method: 'POST' });
  const data = await zohoRequest(`/salesorders/${encodeURIComponent(salesOrder.salesorder_id)}?${organizationQuery()}`);
  const refreshed = data.salesorder || salesOrder;
  if (String(refreshed.status || '').toLowerCase() !== 'open') { const e = new Error('Zoho did not confirm the Sales Order as Open.'); e.statusCode = 409; throw e; }
  return refreshed;
}
async function voidSalesOrder(salesOrderId, reason) {
  try { await zohoRequest(`/salesorders/${encodeURIComponent(salesOrderId)}/status/void?${organizationQuery()}`, { method: 'POST', body: { reason: cleanText(reason, 450) || 'Website checkout cancelled.' } }); } catch (error) { console.error('Failed to void Sales Order during rollback', { salesOrderId: String(salesOrderId), message: error.message }); }
}
async function createInvoiceFromSalesOrder(salesOrderId) {
  const data = await zohoRequest(`/invoices/fromsalesorder?${organizationQuery({ salesorder_id: String(salesOrderId) })}`, { method: 'POST' });
  return data.invoice;
}
async function updateInvoiceControls(invoiceId, reference, courierLocker) {
  const expiresAt = new Date(Date.now() + CHECKOUT_TOKEN_LIFETIME_MS).toISOString();
  const body = {
    allow_partial_payments: false,
    reference_number: reference,
    notes: `Vestige website checkout. FULL PAYMENT ONLY. Courier Locker: ${courierLocker}. Unpaid checkout expires at ${expiresAt}.`,
  };
  const data = await zohoRequest(`/invoices/${encodeURIComponent(invoiceId)}?${organizationQuery()}`, { method: 'PUT', body });
  return data.invoice;
}
async function voidInvoice(invoiceId) {
  try { await zohoRequest(`/invoices/${encodeURIComponent(invoiceId)}/status/void?${organizationQuery()}`, { method: 'POST' }); } catch (error) { console.error('Failed to void invoice during rollback', { invoiceId: String(invoiceId), message: error.message }); }
}
async function markInvoiceSent(invoiceId) {
  await zohoRequest(`/invoices/${encodeURIComponent(invoiceId)}/status/sent?${organizationQuery()}`, { method: 'POST' });
  const invoice = await getInvoice(invoiceId);
  const status = String(invoice.status || '').toLowerCase();
  if (!['sent', 'overdue', 'paid'].includes(status)) {
    const e = new Error('Zoho did not confirm the invoice as Sent.'); e.statusCode = 409; throw e;
  }
  return invoice;
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function confirmInventoryReservation(salesOrder, flavour, itemId, quantity, beforeSnapshot) {
  const refreshedOrder = await getSalesOrderById(salesOrder?.salesorder_id);
  const status = String(refreshedOrder?.status || '').toLowerCase();
  if (!['open', 'invoiced', 'partially_invoiced'].includes(status)) {
    const e = new Error('Zoho did not confirm the Sales Order as an active stock commitment.');
    e.statusCode = 409;
    throw e;
  }
  const lines = Array.isArray(refreshedOrder?.line_items) ? refreshedOrder.line_items : [];
  const productLines = lines.filter(line => String(line.item_id || '') === String(itemId));
  if (productLines.length !== 1 || Math.abs(Number(productLines[0].quantity) - Number(quantity)) > PAYMENT_EPSILON) {
    const e = new Error('Zoho Sales Order stock reservation does not match the requested product quantity.');
    e.statusCode = 409;
    throw e;
  }
  const item = await resolveSelectedProductItem(flavour, itemId, true);
  const locationId = String(beforeSnapshot?.locationId || '');
  const signals = collectStockSignals(item, locationId);
  const negative = Object.entries(signals).find(([, value]) => Number.isFinite(Number(value)) && Number(value) < 0);
  if (negative) {
    const e = new Error('Zoho reports negative available stock after reservation. The transaction was cancelled.');
    e.statusCode = 409;
    e.freshAvailabilityNeeded = true;
    throw e;
  }
  return buildStockSnapshot(flavour, item, 1);
}
function isPaypalConfigured(invoice) {
  const gateways = Array.isArray(invoice?.payment_options?.payment_gateways) ? invoice.payment_options.payment_gateways : [];
  return gateways.some(g => String(g.gateway_name || '').toLowerCase() === 'paypal' && g.configured === true);
}
function isAllowedPaymentHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  if (ALLOWED_PAYMENT_HOSTS.has(host)) return true;
  // Accept exact approved hosts and their subdomains only (e.g. secure.zohosecurepay.com).
  for (const allowed of ALLOWED_PAYMENT_HOSTS) {
    if (host.endsWith('.' + allowed)) return true;
  }
  return false;
}
function validatePaymentUrl(raw) {
  let url;
  try { url = new URL(String(raw || '')); } catch { throw Object.assign(new Error('Zoho returned an invalid payment URL.'), { statusCode: 409 }); }
  if (url.protocol !== 'https:' || !isAllowedPaymentHostname(url.hostname)) {
    const e = new Error('Zoho returned an unapproved payment URL.'); e.statusCode = 409; throw e;
  }
  return url.toString();
}
async function getInvoice(invoiceId) {
  const data = await zohoRequest(`/invoices/${encodeURIComponent(invoiceId)}?${organizationQuery()}`);
  return data.invoice || {};
}
async function generatePaymentLink(invoiceId) {
  const data = await zohoRequest(`/share/paymentlink?${organizationQuery({ transaction_id: String(invoiceId), transaction_type: 'invoice', link_type: 'public', expiry_time: futureDateISO(1) })}`);
  return data.data?.share_link || null;
}
function signCheckout(payload) {
  const secret = checkoutSigningSecret();
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}
function verifyCheckout(token, { allowPaidVerificationGrace = false } = {}) {
  const [encoded, supplied] = String(token || '').split('.');
  if (!encoded || !supplied) { const e = new Error('Invalid checkout token.'); e.statusCode = 401; throw e; }
  const expected = createHmac('sha256', checkoutSigningSecret()).update(encoded).digest('base64url');
  if (!safeEqual(supplied, expected)) { const e = new Error('Invalid checkout token.'); e.statusCode = 401; throw e; }
  let payload; try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch { const e = new Error('Invalid checkout token.'); e.statusCode = 401; throw e; }
  const now = Date.now();
  if (!payload.exp) { const e = new Error('Invalid checkout token.'); e.statusCode = 401; throw e; }
  if (now > Number(payload.exp)) {
    const verifyUntil = Number(payload.verifyUntil || payload.exp);
    if (!allowPaidVerificationGrace || now > verifyUntil) { const e = new Error('Checkout session expired. Please start again.'); e.statusCode = 410; throw e; }
  }
  return payload;
}
async function verifiedSuccessfulPayments(invoiceId, expectedAmount) {
  const paymentData = await zohoRequest(`/invoices/${encodeURIComponent(invoiceId)}/payments?${organizationQuery()}`);
  const summaries = Array.isArray(paymentData.payments) ? paymentData.payments : [];
  const byId = new Map();
  for (const summary of summaries) {
    const id = String(summary.payment_id || '');
    if (id && !byId.has(id)) byId.set(id, summary);
  }
  if (!byId.size) return { successTotal: 0, paymentIds: [], primaryPaymentId: null, onlineTransactionId: null };

  const successful = [];
  for (const [paymentId, summary] of byId) {
    const data = await zohoRequest(`/customerpayments/${encodeURIComponent(paymentId)}?${organizationQuery()}`);
    const payment = data.payment || {};
    if (String(payment.status || '').toLowerCase() !== 'success') continue;
    if (Number(payment.amount_refunded || 0) > PAYMENT_EPSILON) {
      const e = new Error('The recorded payment has been refunded and cannot confirm this order.'); e.statusCode = 409; throw e;
    }
    const onlineTransactionId = String(summary.online_transaction_id || payment.online_transaction_id || '').trim();
    if (!onlineTransactionId) continue;
    const mode = String(payment.payment_mode || summary.payment_mode || '').trim().toLowerCase();
    // Zoho commonly records gateway payments as autotransaction; some account/API
    // variants surface paypal/onlinepayment. A real online_transaction_id is mandatory.
    const onlineMode = !mode || ['paypal', 'autotransaction', 'onlinepayment', 'online payment'].includes(mode);
    if (!onlineMode) continue;
    const allocations = Array.isArray(payment.invoices) ? payment.invoices : [];
    const matching = allocations.filter(i => String(i.invoice_id || '') === String(invoiceId));
    const applied = matching.reduce((sum, i) => sum + (Number(i.amount_applied) || 0), 0);
    if (applied <= 0) continue;
    successful.push({ paymentId, applied, onlineTransactionId, mode });
  }

  const successTotal = successful.reduce((sum, p) => sum + p.applied, 0);
  if (successTotal > Number(expectedAmount) + PAYMENT_EPSILON) { const e = new Error('Payment records exceed the expected invoice amount and require manual review.'); e.statusCode = 409; throw e; }
  // Full-payment-only checkout must resolve to exactly one successful online payment
  // for exactly the invoice total. Multiple successful allocations are treated as an
  // accounting exception rather than silently confirming an ambiguous transaction.
  if (successful.length > 1) { const e = new Error('Multiple successful payments are attached to this full-payment-only invoice. Manual review is required.'); e.statusCode = 409; throw e; }
  const only = successful[0] || null;
  if (only && Math.abs(Number(only.applied) - Number(expectedAmount)) > PAYMENT_EPSILON) {
    return { successTotal, paymentIds: [only.paymentId], primaryPaymentId: null, onlineTransactionId: only.onlineTransactionId };
  }
  return {
    successTotal,
    paymentIds: only ? [only.paymentId] : [],
    primaryPaymentId: only?.paymentId || null,
    onlineTransactionId: only?.onlineTransactionId || null,
  };
}
async function verifySalesOrderAtPayment(checkout) {
  const salesOrder = await getSalesOrderById(checkout.salesOrderId);
  if (!salesOrder || String(salesOrder.salesorder_id || '') !== String(checkout.salesOrderId)) {
    const e = new Error('Sales Order could not be re-verified before confirmation.'); e.statusCode = 409; throw e;
  }
  if (isVoidedStatus(salesOrder.status)) { const e = new Error('The Sales Order has been voided and cannot be confirmed.'); e.statusCode = 409; throw e; }
  if (String(salesOrder.reference_number || '') !== webReference(checkout.checkoutId)) {
    const e = new Error('Sales Order checkout reference no longer matches.'); e.statusCode = 409; throw e;
  }
  const lines = Array.isArray(salesOrder.line_items) ? salesOrder.line_items : [];
  const productLines = lines.filter(line => String(line.item_id || '') === String(checkout.itemId || ''));
  if (productLines.length !== 1 || Math.abs(Number(productLines[0].quantity) - Number(checkout.quantity)) > PAYMENT_EPSILON || Math.abs(Number(productLines[0].rate) - PRODUCT_PRICE_ZAR) > PAYMENT_EPSILON) {
    const e = new Error('Sales Order product details changed after checkout and require manual review.'); e.statusCode = 409; throw e;
  }
  return salesOrder;
}
async function verifyPaymentAndOrder(token) {
  const checkout = verifyCheckout(token, { allowPaidVerificationGrace: true });
  await verifySalesOrderAtPayment(checkout);
  const invoice = await getInvoice(checkout.invoiceId);
  if (String(invoice.invoice_id || '') !== String(checkout.invoiceId) || String(invoice.salesorder_id || '') !== String(checkout.salesOrderId)) { const e = new Error('Invoice/order relationship could not be verified.'); e.statusCode = 409; throw e; }
  if (Math.abs(Number(invoice.total) - Number(checkout.amount)) > PAYMENT_EPSILON) { const e = new Error('Invoice amount does not match the checkout total.'); e.statusCode = 409; throw e; }
  if (invoice.allow_partial_payments !== false) { const e = new Error('The invoice is not configured for full-payment-only checkout.'); e.statusCode = 409; throw e; }
  if (!isPaypalConfigured(invoice)) { const e = new Error('PayPal is not confirmed as active for this invoice.'); e.statusCode = 409; throw e; }
  const balance = Number(invoice.balance);
  if (String(invoice.status || '').toLowerCase() !== 'paid' || !Number.isFinite(balance) || Math.abs(balance) > PAYMENT_EPSILON) { const e = new Error('Full payment has not yet been confirmed by Zoho Books.'); e.statusCode = 402; throw e; }

  const proof = await verifiedSuccessfulPayments(checkout.invoiceId, checkout.amount);
  if (Math.abs(proof.successTotal - Number(checkout.amount)) > PAYMENT_EPSILON || !proof.primaryPaymentId || !proof.onlineTransactionId) { const e = new Error('A successful online PayPal payment for the exact invoice total has not yet been verified.'); e.statusCode = 402; throw e; }

  const verified = {
    salesOrderNumber: checkout.salesOrderNumber,
    invoiceNumber: invoice.invoice_number || checkout.invoiceNumber,
    amount: Number(checkout.amount),
    paidTotal: proof.successTotal,
    paymentId: proof.primaryPaymentId,
  };
  await markCheckoutConfirmed(checkout, verified);
  await bridgeConfirmedWebsiteReservation(checkout.itemId, checkout.checkoutId);
  return verified;
}
async function buildReceiptResponse(token, requestId) {
  const verified = await verifyPaymentAndOrder(token);
  const pdf = await zohoPdf(`/customerpayments/${encodeURIComponent(verified.paymentId)}?${organizationQuery({ accept: 'pdf' })}`);
  const filename = `Vestige-Payment-Receipt-${String(verified.invoiceNumber || 'payment').replace(/[^A-Za-z0-9_-]/g, '-')}.pdf`;
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Vestige-Request-Id': requestId,
    },
    body: pdf.toString('base64'),
    isBase64Encoded: true,
  };
}

exports.handler = async function handler(event) {
  const requestId = randomUUID();
  let diagnosticStage = null; // TEMPORARY test-branch stage marker; contains no credentials.
  // Netlify preserves the original incoming path in Lambda-compatible event.path.
  // Accept only the public rewrite so direct function calls cannot bypass its rate limit.
  if (event.path && event.path !== '/api/zoho') return publicError(404, 'Not found.', requestId);
  if (event.httpMethod !== 'POST') return publicError(405, 'Method not allowed.', requestId, { Allow: 'POST' });
  if (!isAllowedBrowserOrigin(event)) return publicError(403, 'Origin not allowed.', requestId);
  const contentType = String(event.headers?.['content-type'] || event.headers?.['Content-Type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) return publicError(415, 'Content-Type must be application/json.', requestId);
  try {
    requireEnv('ZOHO_CLIENT_ID'); requireEnv('ZOHO_CLIENT_SECRET'); requireEnv('ZOHO_REFRESH_TOKEN'); requireEnv('ZOHO_ORGANIZATION_ID');
    const body = parseJsonBody(event);

    if (body.action === 'availability') {
      // A page load/reload or explicit Retry request must read current stock rather
      // than a warm-instance availability cache. Product-to-item_id mappings remain
      // cached because item identity is stable; only inventory quantities are refreshed.
      const availability = await getProductAvailability(true, false);
      return json(200, { success: true, availability, verifiedAt: new Date().toISOString(), requestId });
    }
    if (body.action === 'connection_test') {
      const expected = requireEnv('ZOHO_ADMIN_TEST_KEY');
      const supplied = event.headers?.['x-vestige-admin-key'] || event.headers?.['X-Vestige-Admin-Key'];
      if (!safeEqual(supplied, expected)) return publicError(401, 'Unauthorized.', requestId);
      diagnosticStage = 'ZOHO_OAUTH_REFRESH';
      await getAccessToken();
      diagnosticStage = 'ZOHO_ORGANIZATIONS_API';
      const data = await zohoRequest('/organizations');
      diagnosticStage = 'ORGANIZATION_VERIFY';
      const organizationId = requireEnv('ZOHO_ORGANIZATION_ID');
      const org = Array.isArray(data.organizations) ? data.organizations.find(o => String(o.organization_id) === organizationId) : null;
      if (!org) return publicError(403, 'Configured Zoho Books organization could not be verified.', requestId);
      diagnosticStage = 'STOCK_MAPPING';
      const availability = await getProductAvailability(true, true);
      diagnosticStage = 'DELIVERY_ITEM';
      const deliveryItem = await requireDeliveryItem();
      diagnosticStage = 'D1_STORAGE';
      const checkoutStorage = await testCheckoutStorage();
      diagnosticStage = 'COMPLETE';
      const stockConnection = Object.fromEntries(Object.entries(availability).map(([flavour, state]) => [flavour, { available: state.available, stock: state.stock, reason: state.reason || null, itemId: resolvedProductItemIds.get(flavour) || null, itemName: state.itemName || null, price: state.price, locationId: state.locationId || null, locationName: state.locationName || null, stockSource: state.stockSource || null }]));
      return json(200, { success: true, message: 'Zoho Books, BC10000 stock mapping and secure checkout storage confirmed.', organization: { organizationId, organizationName: org.name || null }, stockConnection, deliveryItem: { verified: true, name: deliveryItem.name || DELIVERY_ITEM_NAME, rate: Number(deliveryItem.rate) }, checkoutStorage, requestId });
    }
    if (body.action === 'verify_payment') {
      const verified = await verifyPaymentAndOrder(body.checkoutToken);
      return json(200, { success: true, message: 'Full PayPal payment verified in Zoho Books. Your order is confirmed.', order: verified, receiptAvailable: true, requestId });
    }
    if (body.action === 'payment_receipt') {
      return await buildReceiptResponse(body.checkoutToken, requestId);
    }

    if (body.action !== 'prepare_order') return publicError(400, 'Unknown action.', requestId);
    checkoutSigningSecret();
    const order = validateOrder(body);
    const checkoutAttempt = await beginCheckoutAttempt(order);
    if (checkoutAttempt.replay) {
      return json(200, { ...checkoutAttempt.replay, replayed: true, requestId });
    }

    let stockLock = null;
    let salesOrder = null;
    let invoice = null;
    let createdSalesOrderThisAttempt = false;
    let createdInvoiceThisAttempt = false;
    try {
      // Fast preflight validates the browser-carried item_id. The browser never
      // supplies authoritative stock or price; those are re-read from Zoho below.
      const preflight = await requireStockState(order.flavour, order.quantity, order.itemId);
      if (String(preflight.item.item_id) !== String(order.itemId)) {
        const e = new Error('The selected product no longer matches the Zoho Books item catalogue. Please refresh the shop.'); e.statusCode = 409; throw e;
      }

      const deliveryItem = await requireDeliveryItem();
      let customerLock = null;
      let customer;
      try {
        customerLock = await acquireCustomerLock(order.email, order.checkoutId);
        customer = await syncCustomer(order);
      } finally {
        await releaseStockLock(customerLock);
      }

      // A strongly-consistent cross-instance lock serializes the exact item_id across
      // concurrent Netlify function instances. A five-minute lease is renewed during
      // the financial critical section so a slow Zoho response cannot let it expire.
      stockLock = await acquireStockLock(order.itemId, order.checkoutId);
      await renewDistributedLock(stockLock);
      const reference = webReference(order.checkoutId);

      // Crash/network recovery comes BEFORE a fresh stock requirement. If Zoho already
      // created this exact Sales Order, its quantity is already reserved and rejecting
      // it because current available stock fell would strand a valid checkout.
      salesOrder = await findRecoverableSalesOrder(order, customer, deliveryItem, checkoutAttempt.progress || {});
      let beforeSnapshot = null;
      let productItem = null;
      if (!salesOrder) {
        const finalStock = await requireStockState(order.flavour, order.quantity, order.itemId);
        productItem = finalStock.item;
        beforeSnapshot = await applyWebsiteReservationOverlay(finalStock.snapshot, order.itemId, order.checkoutId);
        if (!beforeSnapshot.canFulfil) {
          const e = new Error(beforeSnapshot.stock === 0
            ? 'This flavour has just been reserved by another customer and is now unavailable.'
            : `Only ${beforeSnapshot.stock} unit(s) remain after active website reservations. Please lower the quantity or choose another flavour.`);
          e.statusCode = 409;
          e.freshAvailabilityNeeded = true;
          throw e;
        }
        await renewDistributedLock(stockLock);
        salesOrder = await createSalesOrder(order, customer, productItem, deliveryItem, reference, beforeSnapshot);
        createdSalesOrderThisAttempt = true;
        if (!salesOrder?.salesorder_id) throw new Error('Zoho did not return a Sales Order ID.');
      } else {
        productItem = await resolveSelectedProductItem(order.flavour, order.itemId, true);
      }

      salesOrder = await ensureSalesOrderOpen(salesOrder);
      await saveCheckoutProgress(checkoutAttempt, {
        salesOrderId: String(salesOrder.salesorder_id),
        salesOrderNumber: salesOrder.salesorder_number || null,
        reference,
      });
      // Keep a strongly-consistent website reservation until payment/rollback/expiry.
      // This bridges any delay before Zoho's Items availability fields expose the Open
      // Sales Order commitment to a subsequent checkout on another function instance.
      if (!beforeSnapshot) {
        const recoveryItem = await resolveSelectedProductItem(order.flavour, order.itemId, true);
        beforeSnapshot = buildStockSnapshot(order.flavour, recoveryItem, order.quantity);
      }
      await addWebsiteReservation(order, beforeSnapshot, salesOrder);
      await renewDistributedLock(stockLock);

      invoice = await findRecoverableInvoice(salesOrder, customer.contact_id, reference, checkoutAttempt.progress || {});
      if (!invoice) {
        invoice = await createInvoiceFromSalesOrder(salesOrder.salesorder_id);
        createdInvoiceThisAttempt = true;
        if (!invoice?.invoice_id) throw new Error('Zoho did not return an Invoice ID.');
      }
      await saveCheckoutProgress(checkoutAttempt, {
        invoiceId: String(invoice.invoice_id),
        invoiceNumber: invoice.invoice_number || null,
      });

      const currentInvoiceStatus = String(invoice.status || '').toLowerCase();
      let controlledInvoice = invoice;
      if (currentInvoiceStatus !== 'paid') {
        controlledInvoice = await updateInvoiceControls(invoice.invoice_id, reference, order.courierLocker);
        const controlledStatus = String(controlledInvoice?.status || '').toLowerCase();
        if (!['sent', 'overdue', 'paid'].includes(controlledStatus)) {
          controlledInvoice = await markInvoiceSent(invoice.invoice_id);
        } else {
          // PUT responses can be lighter than GET responses; always refresh before
          // validating payment controls/gateway/financial total.
          controlledInvoice = await getInvoice(invoice.invoice_id);
        }
      } else {
        controlledInvoice = await getInvoice(invoice.invoice_id);
      }

      await saveCheckoutProgress(checkoutAttempt, {
        invoiceId: String(controlledInvoice.invoice_id),
        invoiceNumber: controlledInvoice.invoice_number || null,
        invoiceStatus: String(controlledInvoice.status || ''),
      });
      await renewDistributedLock(stockLock);

      // For a newly-created transaction prove that Zoho reflected the reservation or
      // inventory reduction before exposing a payment link. Recovered transactions
      // were already validated in their original attempt and are validated structurally.
      if (createdSalesOrderThisAttempt && beforeSnapshot) {
        await confirmInventoryReservation(salesOrder, order.flavour, productItem.item_id, order.quantity, beforeSnapshot);
      }

      if (Math.abs(Number(controlledInvoice.total) - Number(order.amount)) > PAYMENT_EPSILON) {
        const e = new Error('Zoho invoice total does not match the server-authoritative checkout total.'); e.statusCode = 409; throw e;
      }
      if (controlledInvoice.allow_partial_payments !== false) { const e = new Error('Zoho did not enforce full-payment-only mode.'); e.statusCode = 409; throw e; }
      if (!isPaypalConfigured(controlledInvoice)) { const e = new Error('PayPal is not configured as an active payment gateway for this invoice.'); e.statusCode = 409; throw e; }

      const rawPaymentUrl = controlledInvoice.invoice_url || await generatePaymentLink(controlledInvoice.invoice_id);
      if (!rawPaymentUrl) { const e = new Error('Zoho did not provide a payment link.'); e.statusCode = 409; throw e; }
      const paymentUrl = validatePaymentUrl(rawPaymentUrl);

      const checkoutToken = signCheckout({
        checkoutId: order.checkoutId,
        salesOrderId: String(salesOrder.salesorder_id),
        salesOrderNumber: salesOrder.salesorder_number || null,
        invoiceId: String(controlledInvoice.invoice_id),
        invoiceNumber: controlledInvoice.invoice_number || null,
        amount: order.amount,
        itemId: String(order.itemId),
        flavour: order.flavour,
        quantity: order.quantity,
        exp: Date.now() + CHECKOUT_TOKEN_LIFETIME_MS,
        verifyUntil: Date.now() + PAYMENT_VERIFICATION_GRACE_MS,
      });

      const responsePayload = {
        success: true,
        pendingPayment: true,
        message: String(controlledInvoice.status || '').toLowerCase() === 'paid'
          ? 'Zoho already records this invoice as paid. Verify payment here to confirm the order and unlock the receipt.'
          : 'Stock reserved. Full payment is required within 30 minutes. Complete payment through the secure Zoho/PayPal page, then verify payment here.',
        paymentUrl,
        checkoutToken,
        expiresInMinutes: 30,
        order: {
          salesOrderNumber: salesOrder.salesorder_number || null,
          invoiceNumber: controlledInvoice.invoice_number || null,
          flavour: order.flavour,
          quantity: order.quantity,
          amount: order.amount,
          courierLocker: order.courierLocker,
        },
      };

      await saveCheckoutPending(checkoutAttempt, responsePayload);
      cachedAvailabilityUntil = 0;
      return json(200, { ...responsePayload, requestId });
    } catch (error) {
      const transient = error.statusCode === 503 || error.statusCode === 504 || error.name === 'AbortError';
      if (!transient) {
        // Deterministic validation/integrity failures unwind unpaid reservations. Never
        // auto-void a paid invoice; money received always wins over cleanup logic.
        let invoicePaid = false;
        if (invoice?.invoice_id) {
          try {
            const current = await getInvoice(invoice.invoice_id);
            invoicePaid = String(current.status || '').toLowerCase() === 'paid' || Math.abs(Number(current.balance || 0)) <= PAYMENT_EPSILON;
          } catch (_) {}
          if (!invoicePaid) await voidInvoice(invoice.invoice_id);
        }
        if (salesOrder?.salesorder_id && !invoicePaid) await voidSalesOrder(salesOrder.salesorder_id, `Website checkout rollback: ${error.message}`);
        if (!invoicePaid) await releaseWebsiteReservation(order.itemId, order.checkoutId);
      }
      // For transient failures retain durable progress. A retry with the same checkout
      // identifier recovers the existing Zoho records instead of duplicating them.
      await markCheckoutFailed(checkoutAttempt, error.message);
      cachedAvailabilityUntil = 0;
      if (!transient) {
        try { error.freshAvailability = await getProductAvailability(true, false); } catch (_) {}
      }
      throw error;
    } finally {
      await releaseStockLock(stockLock);
    }
  } catch (error) {
    const statusCode = error.statusCode || (error instanceof TypeError ? 400 : 500);
    const retryHeaders = error.retryAfter ? { 'Retry-After': error.retryAfter } : {};
    console.error('Zoho integration request failed', { requestId, statusCode, error: error.name, message: error.message });
    if (error.name === 'AbortError') return publicError(504, 'Zoho did not respond in time. Please try again.', requestId);
    if (statusCode === 503) {
      // TEMPORARY TEST-BRANCH DIAGNOSTICS: return only a sanitized category;
      // never return credentials, tokens, response bodies, or authorization data.
      const raw = String(error?.message || '');
      let diagnosticCode = 'ZOHO_TEMPORARY_FAILURE';
      let diagnosticMessage = 'A temporary Zoho/Worker failure occurred.';

      if (error.service === 'checkout_storage' || /checkout storage|D1|database|storage/i.test(raw)) {
        diagnosticCode = 'CHECKOUT_STORAGE_FAILED';
        diagnosticMessage = 'Cloudflare D1 checkout storage is temporarily unavailable.';
      } else if (/request queue is temporarily busy/i.test(raw)) {
        diagnosticCode = 'ZOHO_REQUEST_QUEUE_BUSY';
        diagnosticMessage = 'The Worker Zoho request queue is temporarily busy.';
      } else if (/rate\/concurrency limit reached/i.test(raw)) {
        diagnosticCode = 'ZOHO_RATE_LIMITED';
        diagnosticMessage = 'Zoho returned a rate or concurrency limit response.';
      } else if (/authentication could not be refreshed/i.test(raw)) {
        diagnosticCode = 'ZOHO_AUTH_REFRESH_FAILED';
        diagnosticMessage = 'Zoho OAuth refresh failed. Check client ID, client secret, refresh token, and Zoho Accounts data centre.';
      } else if (/Live Zoho stock could not be read/i.test(raw)) {
        diagnosticCode = 'ZOHO_STOCK_READ_FAILED';
        diagnosticMessage = 'Live Zoho stock could not be read after the availability lookup was attempted.';
      } else if (/Zoho Books API request failed/i.test(raw)) {
        diagnosticCode = 'ZOHO_BOOKS_API_5XX';
        diagnosticMessage = 'Zoho Books returned a server-side failure during the API request.';
      }

      return json(503, {
        success: false,
        message: error.service === 'checkout_storage'
          ? 'Secure checkout storage is temporarily unavailable. Please try again shortly.'
          : 'Zoho Books is temporarily busy. Please try again shortly.',
        requestId,
        diagnosticCode,
        diagnosticMessage,
      }, retryHeaders);
    }
    if ([402, 409, 410, 401].includes(statusCode)) {
      if (statusCode === 409) {
        let availability = error.freshAvailability || null;
        if (!availability) {
          try { availability = await getProductAvailability(true, false); } catch (_) {}
        }
        if (availability) {
          return json(409, { success: false, message: error.message, requestId, availability, verifiedAt: new Date().toISOString() });
        }
      }
      return publicError(statusCode, error.message, requestId);
    }
    if (statusCode >= 500) {
      const raw = String(error?.message || '');
      let diagnosticCode = diagnosticStage && diagnosticStage !== 'COMPLETE'
        ? `CONNECTION_TEST_${diagnosticStage}_FAILED`
        : 'INTERNAL_ERROR';
      let diagnosticMessage = diagnosticStage && diagnosticStage !== 'COMPLETE'
        ? `The protected connection test failed during stage: ${diagnosticStage}.`
        : 'The test deployment hit an internal server error.';

      const missing = raw.match(/^Missing required server environment variable: ([A-Z0-9_]+)$/);
      if (missing) {
        diagnosticCode = 'MISSING_ENV';
        diagnosticMessage = `Missing required runtime variable: ${missing[1]}`;
      } else if (/authentication could not be refreshed/i.test(raw)) {
        diagnosticCode = 'ZOHO_AUTH_REFRESH_FAILED';
        diagnosticMessage = 'Zoho OAuth refresh failed. Check the Zoho client ID, client secret, refresh token, and Accounts URL/data centre.';
      } else if (/Live Zoho stock could not be read/i.test(raw)) {
        diagnosticCode = 'ZOHO_STOCK_READ_FAILED';
        diagnosticMessage = 'Zoho authentication succeeded far enough to attempt stock lookup, but live stock could not be read.';
      } else if (/Zoho Books API request failed/i.test(raw)) {
        // Preserve the connection-test stage so we know exactly which Zoho call failed.
        if (!(diagnosticStage && diagnosticStage !== 'COMPLETE')) {
          diagnosticCode = 'ZOHO_BOOKS_API_FAILED';
          diagnosticMessage = 'Zoho Books API rejected or failed the request.';
        }
      } else if (/checkout storage|D1|database|storage/i.test(raw)) {
        diagnosticCode = 'CHECKOUT_STORAGE_FAILED';
        diagnosticMessage = 'Cloudflare D1 checkout storage failed or is unavailable.';
      }

      return json(statusCode, {
        success: false,
        message: 'Unable to process the request.',
        requestId,
        diagnosticCode,
        diagnosticMessage,
        ...(error.zohoHttpStatus ? { zohoHttpStatus: error.zohoHttpStatus } : {}),
        ...(error.zohoApiCode ? { zohoApiCode: error.zohoApiCode } : {}),
      }, retryHeaders);
    }
    return publicError(statusCode, error.message, requestId, retryHeaders);
  }
};

exports.bindCloudflareRuntime = bindCloudflareRuntime;
