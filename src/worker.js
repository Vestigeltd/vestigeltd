var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node-built-in-modules:crypto
import libDefault from "crypto";
var require_crypto = __commonJS({
  "node-built-in-modules:crypto"(exports, module) {
    module.exports = libDefault;
  }
});

// src/zoho-integration.cjs
var require_zoho_integration = __commonJS({
  "src/zoho-integration.cjs"(exports) {
    "use strict";
    var { randomUUID, timingSafeEqual, createHmac, createHash } = require_crypto();
    var PRODUCT_PRICE_ZAR = 300;
    var DELIVERY_PRICE_ZAR = 60;
    var MAX_QUANTITY = 5;
    var REQUEST_TIMEOUT_MS = 7e3;
    var MAX_LOCAL_ZOHO_CONCURRENCY = 2;
    var MAX_BODY_BYTES = 20 * 1024;
    var BOOKS_API_VERSION = "v3";
    var AVAILABILITY_CACHE_MS = 15 * 1e3;
    var CHECKOUT_TOKEN_LIFETIME_MS = 30 * 60 * 1e3;
    var PAYMENT_VERIFICATION_GRACE_MS = 7 * 24 * 60 * 60 * 1e3;
    var STOCK_LOCK_TTL_MS = 5 * 60 * 1e3;
    var CHECKOUT_PROCESSING_TTL_MS = 5 * 60 * 1e3;
    var WEBSITE_RESERVATION_TTL_MS = 75 * 60 * 1e3;
    var BANK_PAYMENT_WINDOW_MS = 30 * 60 * 1e3;
    var CONFIRMED_RESERVATION_BRIDGE_MS = 5 * 60 * 1e3;
    var LOCAL_ZOHO_QUEUE_WAIT_MS = 8e3;
    var TRANSIENT_GET_RETRY_MS = 350;
    var PAYMENT_EPSILON = 0.01;
    var PRODUCT_NAMES = Object.freeze({
      "Blueberry Mint": "ELFBAR BC10000 - Blueberry Mint",
      "Miami Mint": "ELFBAR BC10000 - Miami Mint",
      "Blue Razz Ice": "ELFBAR BC10000 - Blue Razz Ice",
      "Strawberry Kiwi Ice": "ELFBAR BC10000 - Strawberry Kiwi Ice",
      "Watermelon Ice": "ELFBAR BC10000 - Watermelon Ice"
    });
    var DELIVERY_METHOD_NAME = "The Courier Guy - Locker to Locker";
    var COLLECTION_METHOD_NAME = "Collection from Vestige Ltd";
    var DELIVERY_METHOD_COURIER = "courier_locker";
    var DELIVERY_METHOD_COLLECTION = "collection";
    function validateDeliveryMethod(value) {
      const method = cleanText(value, 40) || DELIVERY_METHOD_COURIER;
      if (![DELIVERY_METHOD_COURIER, DELIVERY_METHOD_COLLECTION].includes(method)) {
        throw new TypeError("Select a valid delivery or collection option.");
      }
      return method;
    }
    __name(validateDeliveryMethod, "validateDeliveryMethod");
    function deliveryChargeFor(method) {
      return method === DELIVERY_METHOD_COLLECTION ? 0 : DELIVERY_PRICE_ZAR;
    }
    __name(deliveryChargeFor, "deliveryChargeFor");
    function deliveryLabelFor(method) {
      return method === DELIVERY_METHOD_COLLECTION ? COLLECTION_METHOD_NAME : DELIVERY_METHOD_NAME;
    }
    __name(deliveryLabelFor, "deliveryLabelFor");
    function collectionAccessCode() {
      const code = requireEnv("VESTIGE_COLLECTION_ACCESS_CODE");
      if (Buffer.byteLength(code, "utf8") < 8) {
        const e = new Error("VESTIGE_COLLECTION_ACCESS_CODE must contain at least 8 characters.");
        e.statusCode = 503;
        throw e;
      }
      return code;
    }
    __name(collectionAccessCode, "collectionAccessCode");
    function issueCollectionAccessToken(checkoutId, suppliedCode) {
      const id = validateCheckoutId(checkoutId);
      const supplied = String(suppliedCode || "");
      if (!safeEqual(supplied, collectionAccessCode())) {
        const e = new Error("Collection access code was not accepted.");
        e.statusCode = 401;
        throw e;
      }
      const now = Date.now();
      return signCheckout({
        type: "collection_access",
        checkoutId: id,
        iat: now,
        exp: now + 15 * 60 * 1e3
      });
    }
    __name(issueCollectionAccessToken, "issueCollectionAccessToken");
    function requireCollectionAccessToken(token, checkoutId) {
      const payload = verifyCheckout(token);
      if (payload.type !== "collection_access" || String(payload.checkoutId || "") !== String(checkoutId || "")) {
        const e = new Error("Collection access has not been authorised for this checkout.");
        e.statusCode = 403;
        throw e;
      }
      return payload;
    }
    __name(requireCollectionAccessToken, "requireCollectionAccessToken");
    var PRODUCT_ITEM_ID_ENVS = Object.freeze({
      "Blueberry Mint": "ZOHO_ITEM_BLUEBERRY_MINT_ID",
      "Miami Mint": "ZOHO_ITEM_MIAMI_MINT_ID",
      "Blue Razz Ice": "ZOHO_ITEM_BLUE_RAZZ_ICE_ID",
      "Strawberry Kiwi Ice": "ZOHO_ITEM_STRAWBERRY_KIWI_ICE_ID",
      "Watermelon Ice": "ZOHO_ITEM_WATERMELON_ICE_ID"
    });
    var STOCK_LOCATION_ID_ENV = "ZOHO_LOCATION_ID";
    var ALLOWED_FLAVOURS = new Set(Object.keys(PRODUCT_NAMES));
    // V35.29.1: Owner inventory catalogue is deliberately separate from the BC10000 checkout allow-list.
    // New ELFA stock can therefore be discovered and monitored without inheriting BC10000 pricing/checkout rules.
    var OWNER_INVENTORY_PRODUCTS = Object.freeze({
      "ELFA MASTER · Dark Cosmo": Object.freeze({ family: "ELFA MASTER", variant: "Dark Cosmo", sku: "ELFH01", expectedRetailPrice: 250, checkoutEnabled: true, nameHints: ["ELFA Master Dark Cosmo", "ELFA Master Dark Cosmo Kit", "ELFA Master Prefilled Pod Kit Dark Cosmo"] }),
      "ELFA MASTER · Dusty Pink": Object.freeze({ family: "ELFA MASTER", variant: "Dusty Pink", sku: "ELFH02", expectedRetailPrice: 250, checkoutEnabled: true, nameHints: ["ELFA Master Dusty Pink", "ELFA Master Dusty Pink Kit", "ELFA Master Prefilled Pod Kit Dusty Pink"] }),
      "ELFA MASTER · Black Knight": Object.freeze({ family: "ELFA MASTER", variant: "Black Knight", sku: "ELFH03", expectedRetailPrice: 250, checkoutEnabled: true, nameHints: ["ELFA Master Black Knight", "ELFA Master Black Knight Kit", "ELFA Master Prefilled Pod Kit Black Knight"] }),
      "ELFA PRO · Grape": Object.freeze({ family: "ELFA PRO", variant: "Grape", sku: "ELFI03", expectedRetailPrice: 150, checkoutEnabled: true, nameHints: ["ELFA PRO Grape 50mg", "ELFA PRO Grape"] }),
      "ELFA PRO · Peach Ice": Object.freeze({ family: "ELFA PRO", variant: "Peach Ice", sku: "ELFI06", expectedRetailPrice: 150, checkoutEnabled: true, nameHints: ["ELFA PRO Peach Ice 50mg", "ELFA PRO Peach Ice"] }),
      "ELFA PRO · Watermelon": Object.freeze({ family: "ELFA PRO", variant: "Watermelon", sku: "ELFI08", expectedRetailPrice: 150, checkoutEnabled: true, nameHints: ["ELFA PRO Watermelon 50mg", "ELFA PRO Watermelon"] }),
      "ELFA PRO · Miami Mint": Object.freeze({ family: "ELFA PRO", variant: "Miami Mint", sku: "ELFI09", expectedRetailPrice: 150, checkoutEnabled: true, nameHints: ["ELFA PRO Miami Mint 50mg", "ELFA PRO Miami Mint"] }),
      "ELFA PRO · Spearmint": Object.freeze({ family: "ELFA PRO", variant: "Spearmint", sku: "ELFI02", expectedRetailPrice: 150, checkoutEnabled: true, nameHints: ["ELFA PRO Spearmint 50mg", "ELFA PRO Spearmint"] })
    });
    // V35.29.1 Phase 2B: immutable server-side checkout catalogue.
    // Browser-submitted prices are never trusted; productKey selects a server-owned definition.
    var BC_CHECKOUT_KEYS_BY_FLAVOUR = Object.freeze({
      "Blueberry Mint": "bc10000:blueberry-mint",
      "Miami Mint": "bc10000:miami-mint",
      "Blue Razz Ice": "bc10000:blue-razz-ice",
      "Strawberry Kiwi Ice": "bc10000:strawberry-kiwi-ice",
      "Watermelon Ice": "bc10000:watermelon-ice"
    });
    var CHECKOUT_PRODUCTS = Object.freeze({
      "bc10000:blueberry-mint": Object.freeze({ family: "BC10000", variant: "Blueberry Mint", inventoryLabel: "BC10000 · Blueberry Mint", displayName: "ELFBAR BC10000 · Blueberry Mint", unitPrice: 300 }),
      "bc10000:miami-mint": Object.freeze({ family: "BC10000", variant: "Miami Mint", inventoryLabel: "BC10000 · Miami Mint", displayName: "ELFBAR BC10000 · Miami Mint", unitPrice: 300 }),
      "bc10000:blue-razz-ice": Object.freeze({ family: "BC10000", variant: "Blue Razz Ice", inventoryLabel: "BC10000 · Blue Razz Ice", displayName: "ELFBAR BC10000 · Blue Razz Ice", unitPrice: 300 }),
      "bc10000:strawberry-kiwi-ice": Object.freeze({ family: "BC10000", variant: "Strawberry Kiwi Ice", inventoryLabel: "BC10000 · Strawberry Kiwi Ice", displayName: "ELFBAR BC10000 · Strawberry Kiwi Ice", unitPrice: 300 }),
      "bc10000:watermelon-ice": Object.freeze({ family: "BC10000", variant: "Watermelon Ice", inventoryLabel: "BC10000 · Watermelon Ice", displayName: "ELFBAR BC10000 · Watermelon Ice", unitPrice: 300 }),
      "elfa-master:dark-cosmo": Object.freeze({ family: "ELFA MASTER", variant: "Dark Cosmo", inventoryLabel: "ELFA MASTER · Dark Cosmo", displayName: "ELFA MASTER · Dark Cosmo + Miami Mint", unitPrice: 250 }),
      "elfa-master:dusty-pink": Object.freeze({ family: "ELFA MASTER", variant: "Dusty Pink", inventoryLabel: "ELFA MASTER · Dusty Pink", displayName: "ELFA MASTER · Dusty Pink + Peach Ice", unitPrice: 250 }),
      "elfa-master:black-knight": Object.freeze({ family: "ELFA MASTER", variant: "Black Knight", inventoryLabel: "ELFA MASTER · Black Knight", displayName: "ELFA MASTER · Black Knight + Pink Lemonade", unitPrice: 250 }),
      "elfa-pro:grape": Object.freeze({ family: "ELFA PRO", variant: "Grape", inventoryLabel: "ELFA PRO · Grape", displayName: "ELFA PRO · Grape · 2-pod pack", unitPrice: 150 }),
      "elfa-pro:peach-ice": Object.freeze({ family: "ELFA PRO", variant: "Peach Ice", inventoryLabel: "ELFA PRO · Peach Ice", displayName: "ELFA PRO · Peach Ice · 2-pod pack", unitPrice: 150 }),
      "elfa-pro:watermelon": Object.freeze({ family: "ELFA PRO", variant: "Watermelon", inventoryLabel: "ELFA PRO · Watermelon", displayName: "ELFA PRO · Watermelon · 2-pod pack", unitPrice: 150 }),
      "elfa-pro:miami-mint": Object.freeze({ family: "ELFA PRO", variant: "Miami Mint", inventoryLabel: "ELFA PRO · Miami Mint", displayName: "ELFA PRO · Miami Mint · 2-pod pack", unitPrice: 150 }),
      "elfa-pro:spearmint": Object.freeze({ family: "ELFA PRO", variant: "Spearmint", inventoryLabel: "ELFA PRO · Spearmint", displayName: "ELFA PRO · Spearmint · 2-pod pack", unitPrice: 150 })
    });
    var CHECKOUT_PRODUCT_KEYS = Object.freeze(Object.keys(CHECKOUT_PRODUCTS));
    function checkoutProductDefinition(productKey) {
      const key = cleanText(productKey, 80).toLowerCase();
      return CHECKOUT_PRODUCTS[key] || null;
    }
    __name(checkoutProductDefinition, "checkoutProductDefinition");
    function checkoutProductKeyFromInput(raw) {
      const supplied = cleanText(raw?.productKey, 80).toLowerCase();
      if (supplied && CHECKOUT_PRODUCTS[supplied]) return supplied;
      const legacyFlavour = cleanText(raw?.flavour ?? raw?.variant, 100);
      return BC_CHECKOUT_KEYS_BY_FLAVOUR[legacyFlavour] || "";
    }
    __name(checkoutProductKeyFromInput, "checkoutProductKeyFromInput");
    function checkoutProductEnabled(spec) {
      if (!spec) return false;
      if (spec.family === "BC10000") return true;
      return OWNER_INVENTORY_PRODUCTS[spec.inventoryLabel]?.checkoutEnabled === true;
    }
    __name(checkoutProductEnabled, "checkoutProductEnabled");
    var ALLOWED_ACCOUNTS_HOSTS = /* @__PURE__ */ new Set([
      "accounts.zoho.com",
      "accounts.zoho.eu",
      "accounts.zoho.in",
      "accounts.zoho.com.au",
      "accounts.zoho.jp",
      "accounts.zoho.ca",
      "accounts.zoho.com.cn",
      "accounts.zoho.sa"
    ]);
    var ALLOWED_API_HOSTS = /* @__PURE__ */ new Set([
      "www.zohoapis.com",
      "www.zohoapis.eu",
      "www.zohoapis.in",
      "www.zohoapis.com.au",
      "www.zohoapis.jp",
      "www.zohoapis.ca",
      "www.zohoapis.com.cn",
      "www.zohoapis.sa"
    ]);
    var ALLOWED_PAYMENT_HOSTS = /* @__PURE__ */ new Set([
      "books.zoho.com",
      "books.zoho.eu",
      "books.zoho.in",
      "books.zoho.com.au",
      "books.zoho.jp",
      "books.zoho.ca",
      "books.zoho.com.cn",
      "books.zoho.sa",
      // Zoho's documented generated invoice payment link uses this secure host.
      "zohosecurepay.com"
    ]);
    var cachedAccessToken = null;
    var cachedApiDomain = null;
    var accessTokenExpiresAt = 0;
    var tokenRefreshPromise = null;
    var activeZohoRequests = 0;
    var cachedAvailability = null;
    var cachedAvailabilityUntil = 0;
    var cachedProductCatalogUntil = 0;
    var PRODUCT_CATALOG_CACHE_MS = 30 * 60 * 1e3;
    var resolvedProductItemIds = /* @__PURE__ */ new Map();
    var resolvedOwnerInventoryItemIds = /* @__PURE__ */ new Map();
    var ownerInventoryResolutionErrors = /* @__PURE__ */ new Map();
    var cachedOwnerInventoryCatalogUntil = 0;
    var d1Database = null;
    function bindCloudflareRuntime(env) {
      d1Database = env?.CHECKOUT_DB || null;
      globalThis.__VESTIGE_ENV = env || {};
    }
    __name(bindCloudflareRuntime, "bindCloudflareRuntime");
    function runtimeEnv(name) {
      const env = globalThis.__VESTIGE_ENV || {};
      const value = env[name];
      if (value !== void 0 && value !== null) return value;
      return typeof process !== "undefined" && process.env ? process.env[name] : void 0;
    }
    __name(runtimeEnv, "runtimeEnv");
    function checkoutStorageError(error) {
      if (error?.service === "checkout_storage") return error;
      if (error?.statusCode) return error;
      const e = new Error("Secure checkout storage is temporarily unavailable.");
      e.statusCode = 503;
      e.service = "checkout_storage";
      e.cause = error;
      return e;
    }
    __name(checkoutStorageError, "checkoutStorageError");
    function requireDatabase() {
      if (!d1Database) {
        const e = new Error("Cloudflare D1 checkout storage is not bound.");
        e.statusCode = 503;
        e.service = "checkout_storage";
        throw e;
      }
      return d1Database;
    }
    __name(requireDatabase, "requireDatabase");
    var D1JsonStore = class {
      static {
        __name(this, "D1JsonStore");
      }
      constructor(namespace) {
        this.namespace = namespace;
      }
      async getWithMetadata(key) {
        try {
          const row = await requireDatabase().prepare(
            "SELECT value_json, etag FROM kv_store WHERE namespace = ?1 AND key = ?2"
          ).bind(this.namespace, String(key)).first();
          if (!row) return null;
          return { data: JSON.parse(row.value_json), etag: String(row.etag) };
        } catch (error) {
          throw checkoutStorageError(error);
        }
      }
      async setJSON(key, value, options = {}) {
        try {
          const db = requireDatabase();
          const k = String(key);
          const json2 = JSON.stringify(value);
          const etag = randomUUID();
          const now = Date.now();
          let result;
          if (options.onlyIfNew) {
            result = await db.prepare(
              "INSERT OR IGNORE INTO kv_store(namespace, key, value_json, etag, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)"
            ).bind(this.namespace, k, json2, etag, now).run();
          } else if (options.onlyIfMatch) {
            result = await db.prepare(
              "UPDATE kv_store SET value_json = ?3, etag = ?4, updated_at = ?5 WHERE namespace = ?1 AND key = ?2 AND etag = ?6"
            ).bind(this.namespace, k, json2, etag, now, String(options.onlyIfMatch)).run();
          } else {
            result = await db.prepare(
              "INSERT INTO kv_store(namespace, key, value_json, etag, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(namespace, key) DO UPDATE SET value_json = excluded.value_json, etag = excluded.etag, updated_at = excluded.updated_at"
            ).bind(this.namespace, k, json2, etag, now).run();
          }
          const changes = Number(result?.meta?.changes || 0);
          return { modified: changes > 0, etag: changes > 0 ? etag : null };
        } catch (error) {
          throw checkoutStorageError(error);
        }
      }
      async delete(key) {
        try {
          await requireDatabase().prepare("DELETE FROM kv_store WHERE namespace = ?1 AND key = ?2").bind(this.namespace, String(key)).run();
        } catch (error) {
          throw checkoutStorageError(error);
        }
      }
    };
    var STORES = /* @__PURE__ */ new Map();
    function getD1Store(name) {
      if (!STORES.has(name)) STORES.set(name, new D1JsonStore(name));
      return STORES.get(name);
    }
    __name(getD1Store, "getD1Store");
    async function getStockLockStore() {
      return getD1Store("vestige-stock-locks");
    }
    __name(getStockLockStore, "getStockLockStore");
    async function getCheckoutStore() {
      return getD1Store("vestige-checkouts");
    }
    __name(getCheckoutStore, "getCheckoutStore");
    async function getReservationStore() {
      return getD1Store("vestige-stock-reservations");
    }
    __name(getReservationStore, "getReservationStore");
    async function getNotificationStore() {
      return getD1Store("vestige-notifications");
    }
    __name(getNotificationStore, "getNotificationStore");
    async function getOwnerStockAdjustmentStore() {
      return getD1Store("vestige-owner-stock-adjustments");
    }
    __name(getOwnerStockAdjustmentStore, "getOwnerStockAdjustmentStore");
    function ownerConsoleUrl() {
      return cleanText(runtimeEnv("OWNER_CONSOLE_URL"), 240) || "https://vestigeltd.co.za/owner.html";
    }
    __name(ownerConsoleUrl, "ownerConsoleUrl");
    var CONTACT_EMAIL = "contact@vestigeltd.co.za";
    function ownerAlertEmail() {
      return CONTACT_EMAIL;
    }
    __name(ownerAlertEmail, "ownerAlertEmail");
    function ownerAlertFromEmail() {
      return CONTACT_EMAIL;
    }
    __name(ownerAlertFromEmail, "ownerAlertFromEmail");
    function resendApiKey() {
      return cleanText(runtimeEnv("RESEND_API_KEY"), 500);
    }
    __name(resendApiKey, "resendApiKey");
    function ownerNotificationConfigured() {
      return Boolean(resendApiKey() && ownerAlertEmail() && ownerAlertFromEmail());
    }
    __name(ownerNotificationConfigured, "ownerNotificationConfigured");
    async function sendOwnerEmail(subject, text, idempotencyKey = "") {
      const apiKey = resendApiKey();
      const to = ownerAlertEmail();
      const from = ownerAlertFromEmail();
      if (!apiKey || !to || !from) {
        return {
          sent: false,
          configured: false,
          message: "Resend owner notifications are not fully configured."
        };
      }
      const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      };
      const safeIdempotencyKey = cleanText(idempotencyKey, 256);
      if (safeIdempotencyKey) headers["Idempotency-Key"] = safeIdempotencyKey;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
          from: `Vestige Vapes <${from}>`,
          to: [to],
          reply_to: to,
          subject: cleanText(subject, 180),
          text: String(text || "").slice(0, 12e3)
        })
      });
      let data = null;
      try {
        data = await response.json();
      } catch (_) {
      }
      if (!response.ok) {
        const message = cleanText(data?.message, 240) || cleanText(data?.error?.message, 240) || `Resend email request failed with HTTP ${response.status}.`;
        const error = new Error(message);
        error.statusCode = 502;
        throw error;
      }
      return {
        sent: true,
        configured: true,
        messageId: cleanText(data?.id, 200) || null
      };
    }
    __name(sendOwnerEmail, "sendOwnerEmail");
    async function notifyOwnerOnce(kind, paymentReference, subject, text) {
      const ref = cleanText(paymentReference, 24).toUpperCase();
      const safeKind = cleanText(kind, 60).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      const key = `${safeKind}:${ref || "general"}`;
      const providerIdempotencyKey = `vestige/${safeKind}/${ref || "general"}`;
      const store = await getNotificationStore();
      const existing = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
      if (existing?.data?.status === "sent") return { sent: true, replayed: true, ...existing.data };
      const now = Date.now();
      if (existing?.data?.status === "sending" && Number(existing.data.leaseExpiresAt || 0) > now) {
        return { sent: false, pending: true, configured: true, replayed: true };
      }
      const attemptId = randomUUID();
      const sending = {
        status: "sending",
        kind: safeKind,
        paymentReference: ref || null,
        attemptId,
        startedAt: now,
        leaseExpiresAt: now + 12e4
      };
      const claimed = existing ? await store.setJSON(key, sending, { onlyIfMatch: existing.etag }) : await store.setJSON(key, sending, { onlyIfNew: true });
      if (!claimed?.modified) {
        const concurrent = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
        if (concurrent?.data?.status === "sent") return { sent: true, replayed: true, ...concurrent.data };
        return { sent: false, pending: true, configured: true, replayed: true };
      }
      try {
        const sent = await sendOwnerEmail(subject, text, providerIdempotencyKey);
        if (!sent.sent) {
          await store.setJSON(key, {
            status: "failed",
            kind: safeKind,
            paymentReference: ref || null,
            failedAt: Date.now(),
            message: cleanText(sent.message, 240) || "Email delivery is not configured."
          }, { onlyIfMatch: claimed.etag });
          return sent;
        }
        const record = {
          status: "sent",
          kind: safeKind,
          paymentReference: ref || null,
          messageId: sent.messageId || null,
          sentAt: Date.now()
        };
        await store.setJSON(key, record, { onlyIfMatch: claimed.etag });
        return { sent: true, replayed: false, ...record };
      } catch (error) {
        try {
          await store.setJSON(key, {
            status: "failed",
            kind: safeKind,
            paymentReference: ref || null,
            failedAt: Date.now(),
            message: cleanText(error?.message, 240) || "Email delivery failed."
          }, { onlyIfMatch: claimed.etag });
        } catch (_) {
        }
        return { sent: false, configured: true, error: cleanText(error?.message, 240) || "Email delivery failed." };
      }
    }
    __name(notifyOwnerOnce, "notifyOwnerOnce");
    function orderStatusUrl() {
      return "https://vestigeltd.co.za/order-status";
    }
    __name(orderStatusUrl, "orderStatusUrl");
    async function sendCustomerEmail(toEmail, subject, text, idempotencyKey = "") {
      const apiKey = resendApiKey();
      const from = ownerAlertFromEmail();
      const to = cleanText(toEmail, 160).toLowerCase();
      if (!apiKey || !from) {
        return { sent: false, configured: false, message: "Resend customer notifications are not fully configured." };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return { sent: false, configured: true, message: "Customer email address is not valid for fulfilment notification." };
      }
      const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      };
      const safeIdempotencyKey = cleanText(idempotencyKey, 256);
      if (safeIdempotencyKey) headers["Idempotency-Key"] = safeIdempotencyKey;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
          from: `Vestige Vapes <${from}>`,
          to: [to],
          reply_to: CONTACT_EMAIL,
          subject: cleanText(subject, 180),
          text: String(text || "").slice(0, 12e3)
        })
      });
      let data = null;
      try {
        data = await response.json();
      } catch (_) {
      }
      if (!response.ok) {
        const message = cleanText(data?.message, 240) || cleanText(data?.error?.message, 240) || `Resend email request failed with HTTP ${response.status}.`;
        return { sent: false, configured: true, message };
      }
      return { sent: true, configured: true, messageId: cleanText(data?.id, 200) || null };
    }
    __name(sendCustomerEmail, "sendCustomerEmail");
    function customerFulfilmentEmail(data, paymentReference, fulfilment, deliveryMethod) {
      const progress = data?.progress || {};
      const customer = progress.customer || {};
      const email = cleanText(customer.email, 160).toLowerCase();
      const customerName = cleanText(customer.customerName || customer.name, 160);
      const firstName = customerName.split(/\s+/).find(Boolean) || "Customer";
      const ref = cleanText(paymentReference, 24).toUpperCase();
      const state = String(fulfilment?.state || "");
      const trackingReference = cleanText(fulfilment?.trackingReference, 100);
      let subject = `Vestige order ${ref} update`;
      let statusText = "Your order status has been updated.";
      if (state === "preparing") {
        subject = `Vestige order ${ref} — being prepared`;
        statusText = "Your payment is confirmed and your order is now being prepared.";
      } else if (state === "ready_for_collection") {
        subject = `Vestige order ${ref} — ready for collection`;
        statusText = "Your order is ready for collection. Collection arrangements remain as agreed with Vestige Ltd.";
      } else if (state === "dispatched") {
        subject = `Vestige order ${ref} — dispatched`;
        statusText = `Your order has been handed to The Courier Guy for locker-to-locker delivery.${trackingReference ? `\n\nTracking reference: ${trackingReference}` : ""}`;
      } else if (state === "completed") {
        if (deliveryMethod === DELIVERY_METHOD_COLLECTION) {
          subject = `Vestige order ${ref} — collected`;
          statusText = "Your order has been marked collected and complete.";
        } else {
          subject = `Vestige order ${ref} — completed`;
          statusText = "Your order has been marked delivered and complete.";
        }
      }
      const text = `Dear ${firstName},\n\n${statusText}\n\nOrder reference: ${ref}\n\nYou can check the latest status here:\n${orderStatusUrl()}\n\nRegards,\nVestige Ltd`;
      return { email, subject, text, state };
    }
    __name(customerFulfilmentEmail, "customerFulfilmentEmail");
    async function notifyCustomerFulfilmentOnce(data, paymentReference, fulfilment, deliveryMethod) {
      const message = customerFulfilmentEmail(data, paymentReference, fulfilment, deliveryMethod);
      const ref = cleanText(paymentReference, 24).toUpperCase();
      const safeState = cleanText(message.state, 40).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      const key = `customer-fulfilment-${safeState}:${ref}`;
      const providerIdempotencyKey = `vestige/customer-fulfilment/${safeState}/${ref}`;
      const store = await getNotificationStore();
      const existing = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
      if (existing?.data?.status === "sent") return { sent: true, replayed: true, ...existing.data };
      const now = Date.now();
      if (existing?.data?.status === "sending" && Number(existing.data.leaseExpiresAt || 0) > now) {
        return { sent: false, pending: true, configured: true, replayed: true };
      }
      const attemptId = randomUUID();
      const sending = { status: "sending", kind: "customer_fulfilment", state: safeState, paymentReference: ref, attemptId, startedAt: now, leaseExpiresAt: now + 12e4 };
      const claimed = existing ? await store.setJSON(key, sending, { onlyIfMatch: existing.etag }) : await store.setJSON(key, sending, { onlyIfNew: true });
      if (!claimed?.modified) {
        const concurrent = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
        if (concurrent?.data?.status === "sent") return { sent: true, replayed: true, ...concurrent.data };
        return { sent: false, pending: true, configured: true, replayed: true };
      }
      try {
        const sent = await sendCustomerEmail(message.email, message.subject, message.text, providerIdempotencyKey);
        if (!sent.sent) {
          await store.setJSON(key, { status: "failed", kind: "customer_fulfilment", state: safeState, paymentReference: ref, failedAt: Date.now(), message: cleanText(sent.message, 240) || "Customer fulfilment email was not sent." }, { onlyIfMatch: claimed.etag });
          return sent;
        }
        const record = { status: "sent", kind: "customer_fulfilment", state: safeState, paymentReference: ref, messageId: sent.messageId || null, sentAt: Date.now() };
        await store.setJSON(key, record, { onlyIfMatch: claimed.etag });
        return { sent: true, replayed: false, ...record };
      } catch (error) {
        try {
          await store.setJSON(key, { status: "failed", kind: "customer_fulfilment", state: safeState, paymentReference: ref, failedAt: Date.now(), message: cleanText(error?.message, 240) || "Customer fulfilment email failed." }, { onlyIfMatch: claimed.etag });
        } catch (_) {
        }
        return { sent: false, configured: true, error: cleanText(error?.message, 240) || "Customer fulfilment email failed." };
      }
    }
    __name(notifyCustomerFulfilmentOnce, "notifyCustomerFulfilmentOnce");
    async function sendOwnerTestNotification() {
      return sendOwnerEmail(
        "Vestige owner notifications are working",
        `This is a live Vestige Vapes notification test sent through Resend.

Owner Console:
${ownerConsoleUrl()}

If you received this email, Worker owner alerts are operational.`
      );
    }
    __name(sendOwnerTestNotification, "sendOwnerTestNotification");
    async function writeAuditEvent(event) {
      try {
        const store = getD1Store("vestige-owner-audit");
        const now = Date.now();
        const id = `${now}-${randomUUID()}`;
        const safe = {
          id,
          at: now,
          action: cleanText(event?.action, 80) || "unknown",
          actor: cleanText(event?.actor, 40) || "system",
          paymentReference: cleanText(event?.paymentReference, 24).toUpperCase() || null,
          outcome: cleanText(event?.outcome, 40) || "recorded",
          message: cleanText(event?.message, 240) || null,
          requestId: cleanText(event?.requestId, 80) || null,
          invoiceId: cleanText(event?.invoiceId, 80) || null,
          paymentId: cleanText(event?.paymentId, 80) || null,
          amount: Number.isFinite(Number(event?.amount)) ? Number(event.amount) : null,
          reservationsReleased: Number.isFinite(Number(event?.reservationsReleased)) ? Number(event.reservationsReleased) : null
        };
        await store.setJSON(id, safe, { onlyIfNew: true });
        return true;
      } catch (_) {
        return false;
      }
    }
    __name(writeAuditEvent, "writeAuditEvent");
    function classifyOwnerException(order, reservations) {
      const state = String(order?.state || "");
      const now = Date.now();
      const expiresAt = Number(order?.paymentExpiresAt || 0);
      const activeReservations = Array.isArray(reservations) ? reservations : [];
      const reservationMissing = Array.isArray(order?.items) && order.items.length > 0 ? activeReservations.some((r) => !r.reservationActive) : false;
      if (state === "confirming_payment") {
        return {
          severity: "critical",
          code: "CONFIRMATION_IN_PROGRESS",
          title: "Payment confirmation in progress",
          message: "This order is in the confirmation state. Review before retrying any financial action."
        };
      }
      if (state === "cancelling_customer" || state === "cancelling_unpaid_admin") {
        return {
          severity: "critical",
          code: "CANCELLATION_IN_PROGRESS",
          title: "Cancellation in progress",
          message: "This order is mid-cancellation. Review reservation state before taking another action."
        };
      }
      if (state === "pending_payment" && Number(order?.paymentClaimedAt || 0) > 0) {
        return {
          severity: "critical",
          code: "PAYMENT_CLAIMED",
          title: "Customer reports payment sent \u2014 verify bank",
          message: expiresAt > 0 && expiresAt <= now ? "The customer says payment was sent. The stock remains on OWNER PAYMENT REVIEW HOLD even though the original timer has ended. Verify the cleared bank credit, then confirm payment or void the unpaid order." : "The customer says payment was sent. The reserved stock is now held for owner payment review. Verify the cleared bank credit, then confirm payment or void the unpaid order."
        };
      }
      if (state === "pending_payment" && reservationMissing) {
        return {
          severity: "critical",
          code: "MISSING_RESERVATION",
          title: "Pending order missing reservation",
          message: "The order is still pending but at least one expected website stock reservation is not active."
        };
      }
      if (state === "pending_payment" && expiresAt > 0 && expiresAt <= now) {
        return {
          severity: "warning",
          code: "PAST_EXPIRY_PENDING",
          title: "Pending order past expiry",
          message: "The reservation window has ended but the checkout still reports pending_payment."
        };
      }
      if (state === "pending_payment" && expiresAt > now && expiresAt - now <= 5 * 60 * 1e3) {
        return {
          severity: "warning",
          code: "EXPIRING_SOON",
          title: "Payment reservation expiring soon",
          message: "The customer has fewer than five minutes remaining in the payment reservation window."
        };
      }
      return null;
    }
    __name(classifyOwnerException, "classifyOwnerException");
    async function adminOrderExceptions(limit = 50) {
      const orders = await adminRecentBankOrders(Math.min(Math.max(Number(limit || 50), 1), 50));
      const exceptions = [];
      for (const order of orders) {
        let reservations = [];
        try {
          const lookup = await adminLookupBankOrder(order.paymentReference);
          reservations = lookup.reservations || [];
          const issue = classifyOwnerException(lookup, reservations);
          if (issue) {
            exceptions.push({
              ...issue,
              paymentReference: lookup.paymentReference,
              state: lookup.state,
              amount: lookup.amount,
              totalQuantity: lookup.totalQuantity,
              paymentExpiresAt: lookup.paymentExpiresAt,
              paymentClaimedAt: lookup.paymentClaimedAt,
              updatedAt: lookup.updatedAt,
              customerName: lookup.customer?.name || null,
              reservations
            });
          }
        } catch (error) {
          exceptions.push({
            severity: "critical",
            code: "LOOKUP_FAILED",
            title: "Order inspection failed",
            message: cleanText(error?.message, 240) || "The owner dashboard could not inspect this order.",
            paymentReference: order.paymentReference,
            state: order.state,
            amount: order.amount,
            totalQuantity: order.totalQuantity,
            paymentExpiresAt: order.paymentExpiresAt,
            paymentClaimedAt: order.paymentClaimedAt,
            updatedAt: order.updatedAt,
            customerName: order.customer?.name || null,
            reservations: []
          });
        }
      }
      exceptions.sort((a, b) => {
        const rank = { critical: 0, warning: 1, info: 2 };
        const ar = rank[a.severity] ?? 9;
        const br = rank[b.severity] ?? 9;
        if (ar !== br) return ar - br;
        return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
      });
      return exceptions;
    }
    __name(adminOrderExceptions, "adminOrderExceptions");
    async function adminRecentAuditEvents(limit = 50) {
      const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 100);
      const db = requireDatabase();
      const result = await db.prepare(
        "SELECT value_json, updated_at FROM kv_store WHERE namespace = ?1 ORDER BY updated_at DESC LIMIT ?2"
      ).bind("vestige-owner-audit", safeLimit).all();
      const events = [];
      for (const row of Array.isArray(result?.results) ? result.results : []) {
        try {
          const value = JSON.parse(row.value_json);
          if (!value || typeof value !== "object") continue;
          events.push(value);
        } catch (_) {
        }
      }
      return events;
    }
    __name(adminRecentAuditEvents, "adminRecentAuditEvents");
    var OWNER_RESET_NAMESPACES = Object.freeze([
      "vestige-checkouts",
      "vestige-order-sequence",
      "vestige-bank-payment-reference-index",
      "vestige-notifications",
      "vestige-stock-reservations"
    ]);
    function ownerResetReference(value) {
      const ref = cleanText(value, 24).toUpperCase();
      return /^V\d{4,8}$/.test(ref) ? ref : null;
    }
    __name(ownerResetReference, "ownerResetReference");
    function ownerResetReferenceNumber(ref) {
      return ref ? Number(String(ref).slice(1)) : NaN;
    }
    __name(ownerResetReferenceNumber, "ownerResetReferenceNumber");
    function ownerResetCheckoutId(row) {
      return String(row?.key || "").replace(/^checkout-/, "");
    }
    __name(ownerResetCheckoutId, "ownerResetCheckoutId");
    function ownerResetHasFinancialEvidence(data) {
      const p = data?.progress || {};
      const verified = p?.verifiedBankPayment || {};
      return Boolean(
        cleanText(p.bankInvoiceId || p.invoiceId || verified.invoiceId, 100) || cleanText(p.bankPaymentId || p.paymentId || verified.paymentId, 100) || cleanText(p.zohoInvoiceId || p.zohoPaymentId, 100)
      );
    }
    __name(ownerResetHasFinancialEvidence, "ownerResetHasFinancialEvidence");
    function ownerResetProtectedState(state) {
      return ["confirmed", "paid", "completed", "fulfilled", "processing_fulfilment", "shipped"].includes(String(state || "").toLowerCase());
    }
    __name(ownerResetProtectedState, "ownerResetProtectedState");
    function ownerResetParseRows(rows) {
      return (Array.isArray(rows) ? rows : []).map((row) => {
        let value = null;
        try {
          value = JSON.parse(row.value_json);
        } catch (_) {
        }
        return { ...row, value };
      });
    }
    __name(ownerResetParseRows, "ownerResetParseRows");
    function buildOwnerTestResetPlan(rawRows) {
      const rows = ownerResetParseRows(rawRows);
      const blockers = [];
      const checkoutRows = rows.filter((r) => r.namespace === "vestige-checkouts");
      const candidates = [];
      const protectedOrders = [];
      const seenRefs = /* @__PURE__ */ new Map();
      for (const row of checkoutRows) {
        const data = row.value;
        if (!data || typeof data !== "object") {
          blockers.push(`Checkout ${row.key} contains unreadable data.`);
          continue;
        }
        const p = data.progress || {};
        const response = data.response || {};
        const ref = ownerResetReference(p.paymentReference || response.paymentReference);
        if (!ref) {
          blockers.push(`Checkout ${row.key} has a missing or invalid payment reference.`);
          continue;
        }
        if (seenRefs.has(ref)) blockers.push(`Payment reference ${ref} is used by more than one checkout.`);
        seenRefs.set(ref, row.key);
        const state = String(data.state || "").toLowerCase();
        const financial = ownerResetHasFinancialEvidence(data);
        const protectedOrder = financial || ownerResetProtectedState(state);
        const item = { row, data, paymentReference: ref, checkoutId: ownerResetCheckoutId(row), state, financial };
        if (state === "confirming_payment" && !financial) {
          blockers.push(`${ref} is currently confirming payment and requires manual review.`);
          protectedOrders.push(item);
        } else if (protectedOrder) protectedOrders.push(item);
        else candidates.push(item);
      }
      const protectedReferences = protectedOrders.map((x) => x.paymentReference).sort((a, b) => ownerResetReferenceNumber(a) - ownerResetReferenceNumber(b));
      const deleteReferences = candidates.map((x) => x.paymentReference).sort((a, b) => ownerResetReferenceNumber(a) - ownerResetReferenceNumber(b));
      const highestProtected = protectedReferences.reduce((m, r) => Math.max(m, ownerResetReferenceNumber(r)), 0);
      const targetSequence = highestProtected;
      const nextNumber = targetSequence + 1;
      let nextReference = null;
      if (nextNumber > 99999999) blockers.push("The website order reference range is exhausted. Cleanup cannot continue.");
      else nextReference = `V${String(nextNumber).padStart(4, "0")}`;
      const sequenceRow = rows.find((r) => r.namespace === "vestige-order-sequence" && r.key === "bank-order");
      const currentSequence = Number(sequenceRow?.value?.value || 0);
      const currentNextReference = currentSequence >= 0 && currentSequence < 99999999 ? `V${String(currentSequence + 1).padStart(4, "0")}` : null;
      const candidateIds = new Set(candidates.map((x) => x.checkoutId));
      const candidateRefs = new Set(deleteReferences);
      const operations = [];
      for (const item of candidates) operations.push({ type: "delete", row: item.row });
      for (const row of rows) {
        if (!row.value || typeof row.value !== "object") continue;
        if (row.namespace === "vestige-bank-payment-reference-index") {
          const ref = ownerResetReference(row.key || row.value.paymentReference);
          const linkedId = cleanText(row.value.checkoutId, 120);
          if (ref === nextReference && !candidateRefs.has(ref) && !candidateIds.has(linkedId)) {
            blockers.push(`The calculated next reference ${nextReference} is still reserved by a payment-reference index.`);
          }
          if (ref && candidateRefs.has(ref) || linkedId && candidateIds.has(linkedId)) operations.push({ type: "delete", row });
        } else if (row.namespace === "vestige-notifications") {
          const serialized = JSON.stringify(row.value);
          if ([...candidateRefs].some((ref) => String(row.key).includes(ref) || serialized.includes(ref)) || [...candidateIds].some((id) => String(row.key).includes(id) || serialized.includes(id))) operations.push({ type: "delete", row });
        } else if (row.namespace === "vestige-stock-reservations" && Array.isArray(row.value.reservations)) {
          const kept = row.value.reservations.filter((r) => !candidateIds.has(String(r?.checkoutId || "")));
          if (kept.length !== row.value.reservations.length) operations.push({ type: "update", row, value: { ...row.value, reservations: kept, updatedAt: Date.now() } });
        }
      }
      if (sequenceRow && currentSequence !== targetSequence) {
        operations.push({ type: "update", row: sequenceRow, value: { value: targetSequence, updatedAt: Date.now() } });
      } else if (!sequenceRow && (candidates.length || protectedOrders.length)) {
        operations.push({ type: "insert", row: { namespace: "vestige-order-sequence", key: "bank-order" }, value: { value: targetSequence, updatedAt: Date.now() } });
      }
      const protectedIds = new Set(protectedOrders.map((x) => x.checkoutId));
      for (const op of operations.filter((x) => x.type === "delete")) {
        const text = `${op.row.key} ${op.row.value_json || ""}`;
        if ([...protectedReferences].some((ref) => text.includes(ref)) || [...protectedIds].some((id) => text.includes(id))) {
          blockers.push(`A proposed cleanup row is linked to a protected genuine order (${op.row.key}).`);
        }
      }
      const candidateSummaries = candidates.sort((a, b) => ownerResetReferenceNumber(a.paymentReference) - ownerResetReferenceNumber(b.paymentReference)).map((x) => ({ paymentReference: x.paymentReference, checkoutId: x.checkoutId, state: x.state || "unknown" }));
      const fingerprintPayload = {
        candidates: candidateSummaries,
        protectedReferences,
        targetSequence,
        nextReference,
        operations: operations.map((op) => ({ type: op.type, namespace: op.row.namespace, key: op.row.key, etag: op.row.etag || null }))
      };
      const fingerprint = createHash("sha256").update(JSON.stringify(fingerprintPayload)).digest("hex");
      const canApply = blockers.length === 0 && candidates.length > 0 && Boolean(nextReference);
      return {
        canApply,
        blockers,
        currentSequence,
        currentNextReference,
        targetSequence,
        nextReference,
        confirmationRequired: nextReference ? `RESET TO ${nextReference}` : null,
        protectedReferences,
        deleteReferences,
        testReferences: deleteReferences,
        candidateSummaries,
        testOrders: candidateSummaries,
        operations,
        fingerprint,
        previewFingerprint: fingerprint
      };
    }
    __name(buildOwnerTestResetPlan, "buildOwnerTestResetPlan");
    async function readOwnerTestResetRows() {
      const db = requireDatabase();
      const placeholders = OWNER_RESET_NAMESPACES.map((_, i) => `?${i + 1}`).join(",");
      const result = await db.prepare(
        `SELECT namespace,key,value_json,etag,updated_at FROM kv_store WHERE namespace IN (${placeholders})`
      ).bind(...OWNER_RESET_NAMESPACES).all();
      return Array.isArray(result?.results) ? result.results : [];
    }
    __name(readOwnerTestResetRows, "readOwnerTestResetRows");
    function publicOwnerResetPreview(plan) {
      return {
        canApply: plan.canApply,
        blockers: plan.blockers,
        currentSequence: plan.currentSequence,
        currentNextReference: plan.currentNextReference,
        targetSequence: plan.targetSequence,
        nextReference: plan.nextReference,
        confirmationRequired: plan.confirmationRequired,
        protectedReferences: plan.protectedReferences,
        testReferences: plan.deleteReferences,
        testOrders: plan.candidateSummaries,
        previewFingerprint: plan.fingerprint,
        zohoBooksChanged: false
      };
    }
    __name(publicOwnerResetPreview, "publicOwnerResetPreview");
    async function adminPreviewTestOrderReset() {
      return publicOwnerResetPreview(buildOwnerTestResetPlan(await readOwnerTestResetRows()));
    }
    __name(adminPreviewTestOrderReset, "adminPreviewTestOrderReset");
    async function adminApplyTestOrderReset(input) {
      const confirmation = cleanText(input?.confirmation, 80).toUpperCase();
      const suppliedFingerprint = cleanText(input?.previewFingerprint, 80).toLowerCase();
      const rows = await readOwnerTestResetRows();
      const plan = buildOwnerTestResetPlan(rows);
      if (!plan.canApply) {
        const e = new Error(plan.blockers[0] || "There are no eligible test orders to clean up.");
        e.statusCode = 409;
        throw e;
      }
      if (!/^[a-f0-9]{64}$/.test(suppliedFingerprint) || !safeEqual(suppliedFingerprint, plan.fingerprint)) {
        const e = new Error("Cleanup preview is stale. Run Preview cleanup again before applying.");
        e.statusCode = 409;
        throw e;
      }
      if (!safeEqual(confirmation, plan.confirmationRequired)) {
        const e = new Error(`Type the exact confirmation phrase: ${plan.confirmationRequired}`);
        e.statusCode = 409;
        throw e;
      }
      const db = requireDatabase();
      const now = Date.now();
      const statements = [];
      for (const op of plan.operations) {
        if (op.type === "delete") {
          statements.push(db.prepare("DELETE FROM kv_store WHERE namespace = ?1 AND key = ?2 AND etag = ?3").bind(op.row.namespace, op.row.key, String(op.row.etag)));
        } else if (op.type === "update") {
          statements.push(db.prepare("UPDATE kv_store SET value_json = ?3, etag = ?4, updated_at = ?5 WHERE namespace = ?1 AND key = ?2 AND etag = ?6").bind(op.row.namespace, op.row.key, JSON.stringify(op.value), randomUUID(), now, String(op.row.etag)));
        } else if (op.type === "insert") {
          statements.push(db.prepare("INSERT INTO kv_store(namespace, key, value_json, etag, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)").bind(op.row.namespace, op.row.key, JSON.stringify(op.value), randomUUID(), now));
        }
      }
      const auditAt = Date.now();
      const auditId = `${auditAt}-${randomUUID()}`;
      const auditValue = { id: auditId, at: auditAt, action: "admin_test_order_reset", actor: "owner", paymentReference: null, outcome: "success", message: `Removed ${plan.deleteReferences.join(", ")}; next website reference ${plan.nextReference}.`, requestId: null, invoiceId: null, paymentId: null, amount: null, reservationsReleased: null };
      statements.push(db.prepare("INSERT INTO kv_store(namespace, key, value_json, etag, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)").bind("vestige-owner-audit", auditId, JSON.stringify(auditValue), randomUUID(), auditAt));
      const results = await db.batch(statements);
      if (results.some((r) => Number(r?.meta?.changes || 0) !== 1)) {
        const e = new Error("Cleanup stopped because D1 changed during the operation. Review the Owner Console before retrying.");
        e.statusCode = 409;
        throw e;
      }
      const verified = buildOwnerTestResetPlan(await readOwnerTestResetRows());
      if (verified.deleteReferences.length || verified.currentSequence !== plan.targetSequence) {
        const e = new Error("Cleanup completed but post-change verification did not match the expected state. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      return {
        success: true,
        nextReference: plan.nextReference,
        targetSequence: plan.targetSequence,
        protectedReferences: plan.protectedReferences,
        removedTestReferences: plan.deleteReferences,
        zohoBooksChanged: false,
        message: `Eligible website test orders removed. Next website reference: ${plan.nextReference}.`
      };
    }
    __name(adminApplyTestOrderReset, "adminApplyTestOrderReset");
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
        return { ok: true, strongConsistency: true, atomicConditionalWrites: true, backend: "Cloudflare D1" };
      } finally {
        try {
          await store.delete(key);
        } catch (_) {
        }
      }
    }
    __name(testAtomicBlobStore, "testAtomicBlobStore");
    async function testCheckoutStorage() {
      try {
        const [checkouts, reservations, locks] = await Promise.all([getCheckoutStore(), getReservationStore(), getStockLockStore()]);
        const stores = {
          checkouts: await testAtomicBlobStore(checkouts, "checkouts"),
          reservations: await testAtomicBlobStore(reservations, "reservations"),
          locks: await testAtomicBlobStore(locks, "locks")
        };
        return { ok: true, strongConsistency: true, atomicConditionalWrites: true, backend: "Cloudflare D1", stores };
      } catch (cause) {
        const e = new Error("Cloudflare D1 checkout storage failed its atomic read/write test.");
        e.statusCode = 503;
        e.service = "checkout_storage";
        e.cause = cause;
        throw e;
      }
    }
    __name(testCheckoutStorage, "testCheckoutStorage");
    function orderFingerprint(order) {
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
        items: Array.isArray(order.items) ? order.items.map((item) => ({ flavour: item.flavour, itemId: item.itemId, quantity: item.quantity })) : void 0
      });
      return createHash("sha256").update(stable).digest("hex");
    }
    __name(orderFingerprint, "orderFingerprint");
    async function beginCheckoutAttempt(order) {
      let store;
      try {
        store = await getCheckoutStore();
      } catch (error) {
        throw checkoutStorageError(error);
      }
      const key = `checkout-${order.checkoutId}`;
      const fingerprint = orderFingerprint(order);
      const ownerId = randomUUID();
      const now = Date.now();
      const processing = { state: "processing", fingerprint, ownerId, progress: {}, expiresAt: now + CHECKOUT_PROCESSING_TTL_MS, updatedAt: now };
      let result = await store.setJSON(key, processing, { onlyIfNew: true });
      if (result?.modified) return { store, key, fingerprint, ownerId, replay: null, progress: {} };
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
        if (!current) {
          result = await store.setJSON(key, processing, { onlyIfNew: true });
          if (result?.modified) return { store, key, fingerprint, ownerId, replay: null, progress: {} };
          continue;
        }
        const data = current.data || {};
        if (data.fingerprint && data.fingerprint !== fingerprint) {
          const e2 = new Error("This checkout identifier belongs to a different order. The shop will generate a new checkout for changed order details.");
          e2.statusCode = 409;
          throw e2;
        }
        if (data.state === "pending_payment" && data.response && data.fingerprint === fingerprint) {
          return { store, key, fingerprint, ownerId: null, replay: data.response, progress: data.progress || {} };
        }
        if (data.state === "confirmed" && data.response && data.fingerprint === fingerprint) {
          return { store, key, fingerprint, ownerId: null, replay: data.response, progress: data.progress || {} };
        }
        if (data.state === "processing" && Number(data.expiresAt || 0) > now) {
          const e2 = new Error("This checkout is already being processed. Please wait a moment and try again.");
          e2.statusCode = 503;
          e2.retryAfter = "2";
          throw e2;
        }
        const takeover = { ...processing, fingerprint, progress: data.progress || {} };
        result = await store.setJSON(key, takeover, { onlyIfMatch: current.etag });
        if (result?.modified) return { store, key, fingerprint, ownerId, replay: null, progress: takeover.progress };
      }
      const e = new Error("Unable to safely acquire the checkout transaction. Please try again.");
      e.statusCode = 503;
      e.retryAfter = "2";
      throw e;
    }
    __name(beginCheckoutAttempt, "beginCheckoutAttempt");
    async function saveCheckoutProgress(ctx, patch) {
      if (!ctx?.store || !ctx?.key || !ctx?.ownerId) return;
      const current = await ctx.store.getWithMetadata(ctx.key, { type: "json", consistency: "strong" });
      if (!current || String(current.data?.ownerId || "") !== String(ctx.ownerId) || current.data?.state !== "processing") {
        const e = new Error("Checkout transaction ownership was lost while recording progress.");
        e.statusCode = 503;
        e.retryAfter = "2";
        throw e;
      }
      const progress = { ...current.data?.progress || {}, ...patch || {} };
      const record = { ...current.data, progress, updatedAt: Date.now(), expiresAt: Date.now() + CHECKOUT_PROCESSING_TTL_MS };
      const result = await ctx.store.setJSON(ctx.key, record, { onlyIfMatch: current.etag });
      if (!result?.modified) {
        const e = new Error("Unable to persist checkout progress safely.");
        e.statusCode = 503;
        e.retryAfter = "2";
        throw e;
      }
      ctx.progress = progress;
    }
    __name(saveCheckoutProgress, "saveCheckoutProgress");
    async function saveCheckoutPending(ctx, response) {
      if (!ctx?.store || !ctx?.key || !ctx?.ownerId) return;
      const current = await ctx.store.getWithMetadata(ctx.key, { type: "json", consistency: "strong" });
      if (!current || String(current.data?.ownerId || "") !== String(ctx.ownerId)) {
        const e = new Error("Checkout transaction ownership was lost before completion.");
        e.statusCode = 503;
        throw e;
      }
      const record = {
        state: "pending_payment",
        fingerprint: ctx.fingerprint,
        progress: current.data?.progress || ctx.progress || {},
        response,
        updatedAt: Date.now(),
        expiresAt: Date.now() + PAYMENT_VERIFICATION_GRACE_MS
      };
      const result = await ctx.store.setJSON(ctx.key, record, { onlyIfMatch: current.etag });
      if (!result?.modified) {
        const e = new Error("Unable to persist the pending checkout safely.");
        e.statusCode = 503;
        throw e;
      }
    }
    __name(saveCheckoutPending, "saveCheckoutPending");
    async function markCheckoutConfirmed(checkout, verified) {
      if (!checkout?.checkoutId) return;
      try {
        const store = await getCheckoutStore();
        const key = `checkout-${String(checkout.checkoutId)}`;
        const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
        if (!current) return;
        const response = current.data?.response || null;
        const record = {
          ...current.data,
          state: "confirmed",
          response,
          verified: {
            paymentId: verified?.paymentId || null,
            amount: Number(verified?.amount || checkout.amount || 0),
            confirmedAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          updatedAt: Date.now(),
          expiresAt: Date.now() + PAYMENT_VERIFICATION_GRACE_MS
        };
        await store.setJSON(key, record, { onlyIfMatch: current.etag });
      } catch (error) {
        console.warn("Unable to mark durable checkout confirmed", { message: error.message });
      }
    }
    __name(markCheckoutConfirmed, "markCheckoutConfirmed");
    async function markCheckoutFailed(ctx, message) {
      if (!ctx?.store || !ctx?.key || !ctx?.ownerId) return;
      try {
        const current = await ctx.store.getWithMetadata(ctx.key, { type: "json", consistency: "strong" });
        if (!current || String(current.data?.ownerId || "") !== String(ctx.ownerId)) return;
        await ctx.store.setJSON(ctx.key, {
          state: "failed",
          fingerprint: ctx.fingerprint,
          progress: current.data?.progress || ctx.progress || {},
          error: cleanText(message, 220),
          updatedAt: Date.now(),
          expiresAt: Date.now() - 1
        }, { onlyIfMatch: current.etag });
      } catch (error) {
        console.warn("Unable to mark checkout attempt failed", { message: error.message });
      }
    }
    __name(markCheckoutFailed, "markCheckoutFailed");
    async function acquireStockLock(itemId, ownerId) {
      let store;
      try {
        store = await getStockLockStore();
      } catch (error) {
        throw checkoutStorageError(error);
      }
      const key = `item-${String(itemId)}`;
      const now = Date.now();
      const payload = { ownerId: String(ownerId), expiresAt: now + STOCK_LOCK_TTL_MS };
      let result = await store.setJSON(key, payload, { onlyIfNew: true });
      if (result?.modified) return { store, key, ownerId: String(ownerId) };
      let current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
      if (!current) {
        result = await store.setJSON(key, payload, { onlyIfNew: true });
        if (result?.modified) return { store, key, ownerId: String(ownerId) };
      } else if (Number(current.data?.expiresAt || 0) <= now) {
        result = await store.setJSON(key, payload, { onlyIfMatch: current.etag });
        if (result?.modified) return { store, key, ownerId: String(ownerId) };
      }
      const e = new Error("Another checkout is reserving this flavour right now. Please wait a moment and try again.");
      e.statusCode = 503;
      e.code = "STOCK_BUSY";
      e.retryAfter = "2";
      throw e;
    }
    __name(acquireStockLock, "acquireStockLock");
    async function renewDistributedLock(lock) {
      if (!lock?.store || !lock?.key || !lock?.ownerId) return lock;
      const current = await lock.store.getWithMetadata(lock.key, { type: "json", consistency: "strong" });
      if (!current || String(current.data?.ownerId || "") !== String(lock.ownerId)) {
        const e = new Error("Distributed checkout lock was lost before the transaction completed.");
        e.statusCode = 503;
        e.retryAfter = "2";
        throw e;
      }
      const result = await lock.store.setJSON(lock.key, { ownerId: String(lock.ownerId), expiresAt: Date.now() + STOCK_LOCK_TTL_MS }, { onlyIfMatch: current.etag });
      if (!result?.modified) {
        const e = new Error("Unable to renew the distributed checkout lock.");
        e.statusCode = 503;
        e.retryAfter = "2";
        throw e;
      }
      return lock;
    }
    __name(renewDistributedLock, "renewDistributedLock");
    async function releaseStockLock(lock) {
      if (!lock?.store || !lock?.key) return;
      try {
        const current = await lock.store.getWithMetadata(lock.key, { type: "json", consistency: "strong" });
        if (!current || String(current.data?.ownerId || "") !== String(lock.ownerId)) return;
        await lock.store.setJSON(lock.key, { ownerId: lock.ownerId, expiresAt: Date.now() - 1, released: true }, { onlyIfMatch: current.etag });
      } catch (error) {
        console.warn("Unable to release distributed stock lock", { message: error.message });
      }
    }
    __name(releaseStockLock, "releaseStockLock");
    async function acquireCustomerLock(email, ownerId) {
      let store;
      try {
        store = await getStockLockStore();
      } catch (error) {
        throw checkoutStorageError(error);
      }
      const digest = createHash("sha256").update(String(email || "").trim().toLowerCase()).digest("hex").slice(0, 32);
      const key = `customer-${digest}`;
      const now = Date.now();
      const payload = { ownerId: String(ownerId), expiresAt: now + STOCK_LOCK_TTL_MS };
      let result = await store.setJSON(key, payload, { onlyIfNew: true });
      if (result?.modified) return { store, key, ownerId: String(ownerId) };
      const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
      if (current && Number(current.data?.expiresAt || 0) <= now) {
        result = await store.setJSON(key, payload, { onlyIfMatch: current.etag });
        if (result?.modified) return { store, key, ownerId: String(ownerId) };
      }
      const e = new Error("This customer record is being updated by another checkout. Please wait a moment and try again.");
      e.statusCode = 503;
      e.retryAfter = "2";
      throw e;
    }
    __name(acquireCustomerLock, "acquireCustomerLock");
    function reservationKey(itemId) {
      return `item-${String(itemId)}`;
    }
    __name(reservationKey, "reservationKey");
    function activeReservationRows(data, now = Date.now()) {
      return (Array.isArray(data?.reservations) ? data.reservations : []).filter(
        (row) => row && row.checkoutId && Number(row.quantity) > 0 && (row.paymentReviewHold === true || Number(row.expiresAt || 0) > now)
      );
    }
    __name(activeReservationRows, "activeReservationRows");
    async function readWebsiteReservations(itemId) {
      const store = await getReservationStore();
      const current = await store.getWithMetadata(reservationKey(itemId), { type: "json", consistency: "strong" });
      return { store, current, reservations: activeReservationRows(current?.data) };
    }
    __name(readWebsiteReservations, "readWebsiteReservations");
    async function mutateWebsiteReservations(itemId, mutator) {
      const store = await getReservationStore();
      const key = reservationKey(itemId);
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
        const base = activeReservationRows(current?.data);
        const nextRows = activeReservationRows({ reservations: mutator(base) });
        const payload = { reservations: nextRows, updatedAt: Date.now() };
        const result = current ? await store.setJSON(key, payload, { onlyIfMatch: current.etag }) : await store.setJSON(key, payload, { onlyIfNew: true });
        if (result?.modified) return nextRows;
      }
      const e = new Error("Unable to update the website stock reservation ledger safely.");
      e.statusCode = 503;
      e.service = "checkout_storage";
      e.retryAfter = "2";
      throw e;
    }
    __name(mutateWebsiteReservations, "mutateWebsiteReservations");
    async function placePaymentReviewHold(itemId, checkoutId, requiredQuantity, claimedAt) {
      const store = await getReservationStore();
      const key = reservationKey(itemId);
      const now = Date.now();
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
        if (!current) {
          const e2 = new Error("The stock reservation could not be found for payment review. Do not assume the item is held.");
          e2.statusCode = 409;
          throw e2;
        }
        const raw = Array.isArray(current.data?.reservations) ? current.data.reservations : [];
        const target = raw.find((row) => String(row?.checkoutId || "") === String(checkoutId));
        if (!target || Number(target.quantity || 0) < Number(requiredQuantity || 0)) {
          const e2 = new Error("The original stock reservation is no longer available for payment review. Owner verification is required.");
          e2.statusCode = 409;
          throw e2;
        }
        const nextRows = raw.filter(
          (row) => row && row.checkoutId && Number(row.quantity) > 0 && (String(row.checkoutId) === String(checkoutId) || row.paymentReviewHold === true || Number(row.expiresAt || 0) > now)
        ).map(
          (row) => String(row.checkoutId) === String(checkoutId) ? {
            ...row,
            paymentReviewHold: true,
            paymentReviewHoldAt: Number(claimedAt || now),
            paymentReviewHoldReason: "customer_reported_payment"
          } : row
        );
        const payload = { reservations: nextRows, updatedAt: now };
        const written = await store.setJSON(key, payload, { onlyIfMatch: current.etag });
        if (written?.modified) return true;
      }
      const e = new Error("Unable to place the order into owner payment review safely.");
      e.statusCode = 503;
      e.retryAfter = "2";
      throw e;
    }
    __name(placePaymentReviewHold, "placePaymentReviewHold");
    async function addWebsiteReservation(order, snapshot, invoice) {
      const checkoutId = String(order.checkoutId);
      const row = {
        checkoutId,
        invoiceId: String(invoice?.invoice_id || ""),
        locationId: String(snapshot?.locationId || ""),
        quantity: Number(order.quantity),
        createdAt: Date.now(),
        expiresAt: Date.now() + WEBSITE_RESERVATION_TTL_MS
      };
      await mutateWebsiteReservations(order.itemId, (rows) => {
        const withoutSelf = rows.filter((existing) => String(existing.checkoutId) !== checkoutId);
        return [...withoutSelf, row];
      });
      return row;
    }
    __name(addWebsiteReservation, "addWebsiteReservation");
    async function releaseWebsiteReservationStrict(itemId, checkoutId) {
      if (!itemId || !checkoutId) return;
      await mutateWebsiteReservations(
        itemId,
        (rows) => rows.filter((row) => String(row.checkoutId) !== String(checkoutId))
      );
    }
    __name(releaseWebsiteReservationStrict, "releaseWebsiteReservationStrict");
    async function releaseWebsiteReservation(itemId, checkoutId) {
      if (!itemId || !checkoutId) return;
      try {
        await mutateWebsiteReservations(itemId, (rows) => rows.filter((row) => String(row.checkoutId) !== String(checkoutId)));
      } catch (error) {
        console.warn("Unable to release website stock reservation", { itemId: String(itemId), checkoutId: String(checkoutId), message: error.message });
      }
    }
    __name(releaseWebsiteReservation, "releaseWebsiteReservation");
    async function bridgeConfirmedWebsiteReservation(itemId, checkoutId) {
      if (!itemId || !checkoutId) return;
      try {
        const now = Date.now();
        await mutateWebsiteReservations(itemId, (rows) => rows.map(
          (row) => String(row.checkoutId) === String(checkoutId) ? {
            ...row,
            confirmedAt: now,
            paymentReviewHold: false,
            paymentReviewReleasedAt: now,
            expiresAt: now + CONFIRMED_RESERVATION_BRIDGE_MS
          } : row
        ));
      } catch (error) {
        console.warn("Unable to shorten confirmed website stock reservation", { itemId: String(itemId), checkoutId: String(checkoutId), message: error.message });
      }
    }
    __name(bridgeConfirmedWebsiteReservation, "bridgeConfirmedWebsiteReservation");
    var OWNER_STOCK_ADJUSTMENT_REASONS = /* @__PURE__ */ new Set(["tester", "sample", "promotional", "damaged", "other", "correction"]);
    function ownerStockAdjustmentKey(itemId) {
      return `item-${String(itemId)}`;
    }
    __name(ownerStockAdjustmentKey, "ownerStockAdjustmentKey");
    function normaliseOwnerStockAdjustmentState(data) {
      const excluded = Math.max(0, Math.floor(Number(data?.excluded || 0)));
      const entries = (Array.isArray(data?.entries) ? data.entries : []).filter((row) => row && Number.isFinite(Number(row.delta))).slice(-100);
      return { excluded, entries, updatedAt: Number(data?.updatedAt || 0) || null };
    }
    __name(normaliseOwnerStockAdjustmentState, "normaliseOwnerStockAdjustmentState");
    async function readOwnerStockAdjustmentState(itemId) {
      const store = await getOwnerStockAdjustmentStore();
      const key = ownerStockAdjustmentKey(itemId);
      const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
      return { store, key, current, state: normaliseOwnerStockAdjustmentState(current?.data) };
    }
    __name(readOwnerStockAdjustmentState, "readOwnerStockAdjustmentState");
    async function mutateOwnerStockAdjustmentState(itemId, mutator) {
      const store = await getOwnerStockAdjustmentStore();
      const key = ownerStockAdjustmentKey(itemId);
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
        const base = normaliseOwnerStockAdjustmentState(current?.data);
        const next = normaliseOwnerStockAdjustmentState(mutator(base));
        next.updatedAt = Date.now();
        const result = current ? await store.setJSON(key, next, { onlyIfMatch: current.etag }) : await store.setJSON(key, next, { onlyIfNew: true });
        if (result?.modified) return next;
      }
      const e = new Error("Unable to update the owner stock-adjustment ledger safely.");
      e.statusCode = 503;
      e.service = "checkout_storage";
      e.retryAfter = "2";
      throw e;
    }
    __name(mutateOwnerStockAdjustmentState, "mutateOwnerStockAdjustmentState");
    async function applyWebsiteReservationOverlay(snapshot, itemId, currentCheckoutId = "") {
      if (!snapshot || !itemId || !Number.isFinite(Number(snapshot.stock))) return snapshot;
      const [{ reservations }, ownerState] = await Promise.all([
        readWebsiteReservations(itemId),
        readOwnerStockAdjustmentState(itemId)
      ]);
      const locationId = String(snapshot.locationId || "");
      const active = reservations.filter(
        (row) => String(row.checkoutId) !== String(currentCheckoutId || "") && String(row.locationId || "") === locationId
      );
      const reserved = active.reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0);
      const ownerExcluded = Math.max(0, Number(ownerState.state?.excluded || 0));
      const reported = Math.max(0, Math.floor(Number(snapshot.stock)));
      const physical = Number.isFinite(Number(snapshot.physicalStock)) ? Math.max(0, Math.floor(Number(snapshot.physicalStock))) : null;
      const totalUnavailable = reserved + ownerExcluded;
      const availabilityBound = physical === null ? Math.max(0, reported - totalUnavailable) : Math.max(0, physical - totalUnavailable);
      const effective = Math.max(0, Math.min(reported, availabilityBound));
      const requested = Math.max(1, Number(snapshot.requestedQuantity) || 1);
      let reason = snapshot.reason;
      if (effective < requested) {
        if (ownerExcluded && reserved) reason = `Only ${effective} unit(s) are currently sellable after website reservations and owner stock adjustments.`;
        else if (ownerExcluded) reason = `Only ${effective} unit(s) are currently sellable after owner stock adjustments.`;
        else reason = `Only ${effective} unit(s) are currently available after active website reservations.`;
      }
      return {
        ...snapshot,
        stock: effective,
        available: snapshot.available === true && effective > 0,
        canFulfil: snapshot.canFulfil === true && effective >= requested,
        reason,
        websiteReserved: reserved,
        ownerExcluded
      };
    }
    __name(applyWebsiteReservationOverlay, "applyWebsiteReservationOverlay");
    function json(statusCode, payload, extraHeaders = {}) {
      return {
        statusCode,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
          Pragma: "no-cache",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          ...extraHeaders
        },
        body: JSON.stringify(payload)
      };
    }
    __name(json, "json");
    function publicError(statusCode, message, requestId, extraHeaders = {}) {
      return json(statusCode, { success: false, message, requestId }, extraHeaders);
    }
    __name(publicError, "publicError");
    function requireEnv(name) {
      const value = runtimeEnv(name);
      if (!value || !String(value).trim()) throw new Error(`Missing required server environment variable: ${name}`);
      return String(value).trim();
    }
    __name(requireEnv, "requireEnv");
    function checkoutSigningSecret() {
      const secret = requireEnv("CHECKOUT_SIGNING_SECRET");
      if (Buffer.byteLength(secret, "utf8") < 32) {
        const e = new Error("CHECKOUT_SIGNING_SECRET must contain at least 32 bytes of unpredictable server-only data.");
        e.statusCode = 503;
        throw e;
      }
      return secret;
    }
    __name(checkoutSigningSecret, "checkoutSigningSecret");
    function safeEqual(a, b) {
      const left = Buffer.from(String(a || ""), "utf8");
      const right = Buffer.from(String(b || ""), "utf8");
      return left.length === right.length && timingSafeEqual(left, right);
    }
    __name(safeEqual, "safeEqual");
    function getAccountsUrl() {
      const raw = runtimeEnv("ZOHO_ACCOUNTS_URL") || "https://accounts.zoho.com";
      const url = new URL(raw);
      if (url.protocol !== "https:" || !ALLOWED_ACCOUNTS_HOSTS.has(url.hostname)) throw new Error("ZOHO_ACCOUNTS_URL is not approved.");
      return `${url.protocol}//${url.hostname}`;
    }
    __name(getAccountsUrl, "getAccountsUrl");
    function getExpectedBrowserOrigins(event) {
      const origins = /* @__PURE__ */ new Set();
      for (const raw of [runtimeEnv("ALLOWED_ORIGIN"), runtimeEnv("URL"), runtimeEnv("DEPLOY_PRIME_URL"), runtimeEnv("DEPLOY_URL")]) {
        if (!raw) continue;
        try {
          origins.add(new URL(raw).origin);
        } catch (_) {
        }
      }
      const host = event.headers?.host || event.headers?.Host;
      if (host && /^[A-Za-z0-9.-]+(?::\d+)?$/.test(host)) origins.add(`https://${host}`);
      return origins;
    }
    __name(getExpectedBrowserOrigins, "getExpectedBrowserOrigins");
    function isAllowedBrowserOrigin(event) {
      const origin = event.headers?.origin || event.headers?.Origin;
      if (!origin) return true;
      try {
        const normalized = new URL(origin).origin;
        return getExpectedBrowserOrigins(event).has(normalized);
      } catch (_) {
        return false;
      }
    }
    __name(isAllowedBrowserOrigin, "isAllowedBrowserOrigin");
    function parseJsonBody(event) {
      if (!event.body) throw new TypeError("Request body is required.");
      if (Buffer.byteLength(event.body, "utf8") > MAX_BODY_BYTES) {
        const e = new Error("Payload too large.");
        e.statusCode = 413;
        throw e;
      }
      try {
        return JSON.parse(event.body);
      } catch {
        const e = new TypeError("Invalid JSON body.");
        e.statusCode = 400;
        throw e;
      }
    }
    __name(parseJsonBody, "parseJsonBody");
    function cleanText(value, maxLength) {
      return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
    }
    __name(cleanText, "cleanText");
    function cleanMultiline(value, maxLength) {
      return typeof value === "string" ? value.trim().replace(/\r/g, "").slice(0, maxLength) : "";
    }
    __name(cleanMultiline, "cleanMultiline");
    function validateCourierLocker(value) {
      const locker = cleanText(value, 120);
      if (locker.length < 2 || !/^[A-Za-z0-9 ]+$/.test(locker)) {
        throw new TypeError("Courier Locker is required and may contain only letters, numbers and spaces.");
      }
      return locker;
    }
    __name(validateCourierLocker, "validateCourierLocker");
    function validateCheckoutId(value) {
      const id = cleanText(value, 64);
      if (!/^[A-Za-z0-9-]{16,64}$/.test(id)) throw new TypeError("Invalid checkout request identifier.");
      return id;
    }
    __name(validateCheckoutId, "validateCheckoutId");
    function validateOrder(input) {
      const customerName = cleanText(input.customerName ?? input.name, 100);
      const email = cleanText(input.email, 100).toLowerCase();
      const mobile = cleanText(input.mobile, 50);
      const addressLine1 = cleanMultiline(input.addressLine1 ?? input.address, 500);
      const addressLine2 = cleanText(input.addressLine2, 255);
      const city = cleanText(input.city, 100);
      const province = cleanText(input.province ?? input.state, 100);
      const postalCode = cleanText(input.postalCode ?? input.zip, 50);
      const country = cleanText(input.country, 100) || "South Africa";
      const courierLocker = validateCourierLocker(input.courierLocker);
      const checkoutId = validateCheckoutId(input.checkoutId);
      const flavour = cleanText(input.flavour, 100);
      const requestedItemId = cleanText(input.itemId, 40);
      const itemId = /^\d+$/.test(requestedItemId) ? requestedItemId : "";
      const quantity = Number(input.quantity);
      const submittedAmount = Number(input.amount);
      if (customerName.length < 2) throw new TypeError("A valid customer name is required.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TypeError("A valid email address is required.");
      if (!/^[+()\d\s.-]{7,50}$/.test(mobile) || (mobile.match(/\d/g) || []).length < 7) throw new TypeError("A valid mobile number is required.");
      if (addressLine1.length < 3) throw new TypeError("A valid billing street address is required.");
      if (addressLine2.length < 2 || city.length < 2 || province.length < 2 || postalCode.length < 3 || country.length < 2) throw new TypeError("A complete billing/contact address is required.");
      if (!ALLOWED_FLAVOURS.has(flavour)) throw new TypeError("A valid BC10000 flavour is required.");
      if (!itemId) throw new TypeError("A verified Zoho item identifier is required. Please reload the shop and select a flavour again.");
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new TypeError("Quantity must be between 1 and 5.");
      const amount = quantity * PRODUCT_PRICE_ZAR + DELIVERY_PRICE_ZAR;
      if (!Number.isFinite(submittedAmount) || Math.abs(submittedAmount - amount) > PAYMENT_EPSILON) {
        const e = new TypeError("The submitted total does not match server pricing.");
        e.statusCode = 400;
        throw e;
      }
      return { customerName, email, mobile, addressLine1, addressLine2, city, province, postalCode, country, courierLocker, checkoutId, flavour, itemId, quantity, amount };
    }
    __name(validateOrder, "validateOrder");
    function validateBankCartOrder(input, { trustedStored = false } = {}) {
      const customerName = cleanText(input.customerName ?? input.name, 100);
      const email = cleanText(input.email, 100).toLowerCase();
      const mobile = cleanText(input.mobile, 50);
      const addressLine1 = cleanMultiline(input.addressLine1 ?? input.address, 500);
      const addressLine2 = cleanText(input.addressLine2, 255);
      const city = cleanText(input.city, 100);
      const province = cleanText(input.province ?? input.state, 100);
      const postalCode = cleanText(input.postalCode ?? input.zip, 50);
      const country = cleanText(input.country, 100) || "South Africa";
      const deliveryMethod = validateDeliveryMethod(input.deliveryMethod);
      const deliveryCharge = deliveryChargeFor(deliveryMethod);
      const courierLocker = deliveryMethod === DELIVERY_METHOD_COLLECTION ? "Collection" : validateCourierLocker(input.courierLocker);
      const checkoutId = validateCheckoutId(input.checkoutId);
      if (deliveryMethod === DELIVERY_METHOD_COLLECTION && !trustedStored) {
        requireCollectionAccessToken(input.collectionAccessToken, checkoutId);
      }
      if (customerName.length < 2) throw new TypeError("A valid customer name is required.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TypeError("A valid email address is required.");
      if (!/^[+()\d\s.-]{7,50}$/.test(mobile) || (mobile.match(/\d/g) || []).length < 7) throw new TypeError("A valid mobile number is required.");
      if (addressLine1.length < 3) throw new TypeError("A valid billing street address is required.");
      if (addressLine2.length < 2 || city.length < 2 || province.length < 2 || postalCode.length < 3 || country.length < 2) throw new TypeError("A complete billing/contact address is required.");
      const rawItems = Array.isArray(input.items) ? input.items : [];
      if (rawItems.length < 1 || rawItems.length > CHECKOUT_PRODUCT_KEYS.length) throw new TypeError("Add at least one valid product to the basket.");
      const seenProductKeys = /* @__PURE__ */ new Set();
      const seenItemIds = /* @__PURE__ */ new Set();
      const items = rawItems.map((raw) => {
        const productKey = checkoutProductKeyFromInput(raw);
        const spec = checkoutProductDefinition(productKey);
        const requestedItemId = cleanText(raw?.itemId, 40);
        const itemId = /^\d+$/.test(requestedItemId) ? requestedItemId : "";
        const quantity = Number(raw?.quantity);
        if (!spec || !checkoutProductEnabled(spec)) throw new TypeError("Select a valid product that is enabled for checkout.");
        if (!itemId) throw new TypeError("A verified Zoho item identifier is required. Please reload the shop and rebuild the basket.");
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new TypeError("Each product quantity must be between 1 and 5.");
        if (seenProductKeys.has(productKey) || seenItemIds.has(itemId)) throw new TypeError("Each product variant may appear only once in the basket.");
        seenProductKeys.add(productKey);
        seenItemIds.add(itemId);
        const unitPrice = Number(spec.unitPrice);
        return {
          productKey,
          productFamily: spec.family,
          variant: spec.variant,
          flavour: spec.variant,
          displayName: spec.displayName,
          itemId,
          quantity,
          unitPrice,
          lineTotal: unitPrice * quantity
        };
      });
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const productsTotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
      const amount = productsTotal + deliveryCharge;
      const submittedAmount = Number(input.amount);
      if (!Number.isFinite(submittedAmount) || Math.abs(submittedAmount - amount) > PAYMENT_EPSILON) {
        const e = new TypeError("The submitted total does not match server pricing.");
        e.statusCode = 400;
        throw e;
      }
      return { customerName, email, mobile, addressLine1, addressLine2, city, province, postalCode, country, deliveryMethod, deliveryCharge, courierLocker, checkoutId, items, totalQuantity, productsTotal, amount };
    }
    __name(validateBankCartOrder, "validateBankCartOrder");
    function splitName(fullName) {
      const parts = fullName.trim().split(/\s+/);
      return { firstName: parts.shift() || fullName, lastName: parts.join(" ") };
    }
    __name(splitName, "splitName");
    function buildBillingAddress(order) {
      return { attention: order.customerName, address: order.addressLine1, street2: order.addressLine2, city: order.city, state: order.province, zip: order.postalCode, country: order.country, phone: order.mobile };
    }
    __name(buildBillingAddress, "buildBillingAddress");
    function buildPrimaryPerson(order, contactPersonId) {
      const { firstName, lastName } = splitName(order.customerName);
      return { ...contactPersonId ? { contact_person_id: String(contactPersonId) } : {}, first_name: firstName, last_name: lastName, email: order.email, phone: order.mobile, mobile: order.mobile, is_primary_contact: true };
    }
    __name(buildPrimaryPerson, "buildPrimaryPerson");
    async function fetchWithTimeout(url, options) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    }
    __name(fetchWithTimeout, "fetchWithTimeout");
    async function withZohoSlot(work) {
      const started = Date.now();
      while (activeZohoRequests >= MAX_LOCAL_ZOHO_CONCURRENCY) {
        if (Date.now() - started >= LOCAL_ZOHO_QUEUE_WAIT_MS) {
          const e = new Error("Zoho request queue is temporarily busy.");
          e.statusCode = 503;
          e.retryAfter = "2";
          throw e;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      activeZohoRequests += 1;
      try {
        return await work();
      } finally {
        activeZohoRequests -= 1;
      }
    }
    __name(withZohoSlot, "withZohoSlot");
    async function refreshAccessToken() {
      const form = new URLSearchParams({ refresh_token: requireEnv("ZOHO_REFRESH_TOKEN"), client_id: requireEnv("ZOHO_CLIENT_ID"), client_secret: requireEnv("ZOHO_CLIENT_SECRET"), grant_type: "refresh_token" });
      const response = await fetchWithTimeout(`${getAccountsUrl()}/oauth/v2/token`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
      let data = {};
      try {
        data = await response.json();
      } catch (_) {
      }
      if (!response.ok || !data.access_token || !data.api_domain) {
        console.error("Zoho OAuth refresh failed", { status: response.status, error: data.error || "unknown" });
        throw new Error("Zoho OAuth authentication failed.");
      }
      const apiUrl = new URL(data.api_domain);
      if (apiUrl.protocol !== "https:" || !ALLOWED_API_HOSTS.has(apiUrl.hostname)) throw new Error("Zoho returned an unapproved API domain.");
      const expiresIn = Number(data.expires_in) > 600 ? Number(data.expires_in) : 3600;
      cachedAccessToken = data.access_token;
      cachedApiDomain = `${apiUrl.protocol}//${apiUrl.hostname}`;
      accessTokenExpiresAt = Date.now() + Math.max(60, expiresIn - 300) * 1e3;
      return { accessToken: cachedAccessToken, apiDomain: cachedApiDomain };
    }
    __name(refreshAccessToken, "refreshAccessToken");
    async function getAccessToken() {
      if (cachedAccessToken && cachedApiDomain && Date.now() < accessTokenExpiresAt) return { accessToken: cachedAccessToken, apiDomain: cachedApiDomain };
      if (!tokenRefreshPromise) tokenRefreshPromise = refreshAccessToken().finally(() => {
        tokenRefreshPromise = null;
      });
      return tokenRefreshPromise;
    }
    __name(getAccessToken, "getAccessToken");
    function clearCachedAccessToken() {
      cachedAccessToken = null;
      cachedApiDomain = null;
      accessTokenExpiresAt = 0;
    }
    __name(clearCachedAccessToken, "clearCachedAccessToken");
    async function zohoRequest(path, { method = "GET", body } = {}) {
      return withZohoSlot(async () => {
        const normalizedMethod = String(method || "GET").toUpperCase();
        const maxAttempts = normalizedMethod === "GET" ? 3 : 2;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const { accessToken, apiDomain } = await getAccessToken();
          const response = await fetchWithTimeout(`${apiDomain}/books/${BOOKS_API_VERSION}${path}`, { method: normalizedMethod, headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, Accept: "application/json", ...body === void 0 ? {} : { "Content-Type": "application/json" } }, ...body === void 0 ? {} : { body: JSON.stringify(body) } });
          let data = {};
          try {
            data = await response.json();
          } catch (_) {
          }
          if (response.status === 401 && attempt === 0) {
            clearCachedAccessToken();
            continue;
          }
          const transient = response.status === 429 || [502, 503, 504].includes(response.status);
          if (transient && normalizedMethod === "GET" && attempt < maxAttempts - 1) {
            const retryAfterSeconds = Number(response.headers.get("retry-after"));
            const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? Math.min(3e3, retryAfterSeconds * 1e3) : TRANSIENT_GET_RETRY_MS * (attempt + 1);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }
          if (response.status === 429) {
            const e2 = new Error("Zoho rate/concurrency limit reached.");
            e2.statusCode = 503;
            e2.retryAfter = response.headers.get("retry-after") || "2";
            throw e2;
          }
          if (!response.ok || data.code !== 0) {
            console.error("Zoho Books API request failed", { status: response.status, code: data.code, method: normalizedMethod });
            const e2 = new Error("Zoho Books API request failed.");
            e2.statusCode = response.status >= 500 ? 503 : 502;
            e2.zohoHttpStatus = Number(response.status) || null;
            e2.zohoApiCode = typeof data.code === "number" || typeof data.code === "string" ? String(data.code) : null;
            e2.zohoApiMessage = typeof data.message === "string" ? cleanText(data.message, 240) : null;
            throw e2;
          }
          return data;
        }
        const e = new Error("Zoho authentication could not be refreshed.");
        e.statusCode = 503;
        throw e;
      });
    }
    __name(zohoRequest, "zohoRequest");
    async function zohoPdf(path) {
      return withZohoSlot(async () => {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const { accessToken, apiDomain } = await getAccessToken();
          const response = await fetchWithTimeout(`${apiDomain}/books/${BOOKS_API_VERSION}${path}`, { method: "GET", headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, Accept: "application/pdf" } });
          if (response.status === 401 && attempt === 0) {
            clearCachedAccessToken();
            continue;
          }
          if (!response.ok) {
            const e2 = new Error("Unable to retrieve Zoho payment receipt.");
            e2.statusCode = response.status >= 500 ? 503 : 502;
            throw e2;
          }
          const bytes = Buffer.from(await response.arrayBuffer());
          if (!bytes.length || bytes.slice(0, 4).toString("ascii") !== "%PDF") {
            const e2 = new Error("Zoho did not return a valid receipt PDF.");
            e2.statusCode = 502;
            throw e2;
          }
          return bytes;
        }
        const e = new Error("Zoho authentication could not be refreshed.");
        e.statusCode = 503;
        throw e;
      });
    }
    __name(zohoPdf, "zohoPdf");
    function organizationQuery(extra = {}) {
      const params = new URLSearchParams({ organization_id: requireEnv("ZOHO_ORGANIZATION_ID"), ...extra });
      return params.toString();
    }
    __name(organizationQuery, "organizationQuery");
    function asFiniteStock(value) {
      if (value === null || value === void 0 || value === "") return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    __name(asFiniteStock, "asFiniteStock");
    function firstFiniteStock(...values) {
      for (const value of values) {
        const n = asFiniteStock(value);
        if (n !== null) return n;
      }
      return null;
    }
    __name(firstFiniteStock, "firstFiniteStock");
    function explicitItemAvailableStock(item) {
      return firstFiniteStock(item?.available_stock, item?.actual_available_stock);
    }
    __name(explicitItemAvailableStock, "explicitItemAvailableStock");
    function locationStockReading(location, item = null) {
      for (const field of ["location_available_stock", "location_actual_available_stock"]) {
        const value = asFiniteStock(location?.[field]);
        if (value !== null) return { value, source: field, explicit: true };
      }
      const physical = asFiniteStock(location?.location_stock_on_hand);
      if (physical !== null) {
        const aggregateAvailable = explicitItemAvailableStock(item);
        if (aggregateAvailable !== null) {
          return { value: Math.min(physical, aggregateAvailable), source: "location_stock_on_hand_capped_by_item_available", explicit: false };
        }
        return { value: physical, source: "location_stock_on_hand", explicit: false };
      }
      return { value: null, source: null, explicit: false };
    }
    __name(locationStockReading, "locationStockReading");
    function locationPhysicalStock(location) {
      return firstFiniteStock(
        location?.location_stock_on_hand,
        location?.location_actual_available_stock,
        location?.location_available_stock
      );
    }
    __name(locationPhysicalStock, "locationPhysicalStock");
    function collectStockSignals(item, locationId = "") {
      const signals = {};
      const locations = Array.isArray(item?.locations) ? item.locations : [];
      const location = locationId ? locations.find((l) => String(l?.location_id || "") === String(locationId)) : null;
      const source = location || (locations.length === 1 ? locations[0] : null);
      if (source) {
        for (const field of ["location_available_stock", "location_actual_available_stock", "location_stock_on_hand"]) {
          const value = asFiniteStock(source[field]);
          if (value !== null) signals[field] = value;
        }
      }
      for (const field of ["available_stock", "actual_available_stock", "stock_on_hand"]) {
        const value = asFiniteStock(item?.[field]);
        if (value !== null) signals[`item_${field}`] = value;
      }
      return signals;
    }
    __name(collectStockSignals, "collectStockSignals");
    function chooseStockLocation(item, requestedQuantity = 1) {
      const configuredLocationId = String(runtimeEnv(STOCK_LOCATION_ID_ENV) || "").trim();
      const locations = (Array.isArray(item?.locations) ? item.locations : []).filter((location) => String(location?.status || "active").toLowerCase() !== "inactive");
      const activeLocations = locations.map((location) => {
        const reading = locationStockReading(location, item);
        return {
          location,
          locationId: String(location?.location_id || ""),
          available: reading.value,
          stockSource: reading.source,
          explicitAvailable: reading.explicit === true,
          physical: locationPhysicalStock(location),
          isPrimary: location?.is_primary === true
        };
      }).filter((entry) => entry.locationId && entry.available !== null);
      if (configuredLocationId) {
        const configured = activeLocations.find((entry) => entry.locationId === configuredLocationId);
        if (!configured) {
          const e = new Error("The configured Zoho stock location is not present on this item.");
          e.statusCode = 409;
          throw e;
        }
        return configured;
      }
      if (activeLocations.length) {
        if (activeLocations.length > 1 && activeLocations.every((entry) => !entry.explicitAvailable)) {
          const primary = activeLocations.find((entry) => entry.isPrimary);
          if (!primary) {
            const e = new Error("Multiple Zoho stock locations are ambiguous. Configure ZOHO_LOCATION_ID for website orders.");
            e.statusCode = 409;
            throw e;
          }
          return primary;
        }
        const qty = Math.max(1, Number(requestedQuantity) || 1);
        const fulfillable = activeLocations.filter((entry) => Number(entry.available) >= qty);
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
      for (const field of ["available_stock", "actual_available_stock", "stock_on_hand"]) {
        const value = asFiniteStock(item?.[field]);
        if (value !== null) {
          available = value;
          stockSource = `item_${field}`;
          break;
        }
      }
      const physical = firstFiniteStock(item?.stock_on_hand, item?.actual_available_stock, item?.available_stock);
      return { location: null, locationId: "", available, stockSource, physical, isPrimary: false, explicitAvailable: stockSource !== "item_stock_on_hand" };
    }
    __name(chooseStockLocation, "chooseStockLocation");
    function normalizeItemName(value) {
      return String(value || "").normalize("NFKC").trim().replace(/[\u2010-\u2015]/g, "-").replace(/[^a-zA-Z0-9]+/g, " ").replace(/\s+/g, " ").toLowerCase();
    }
    __name(normalizeItemName, "normalizeItemName");
    function flavourTokens(flavour) {
      return normalizeItemName(flavour).split(" ").filter(Boolean);
    }
    __name(flavourTokens, "flavourTokens");
    function itemMatchScore(item, flavour) {
      const n = normalizeItemName(item?.name);
      if (!n) return -1;
      const expected = normalizeItemName(PRODUCT_NAMES[flavour]);
      const plainFlavour = normalizeItemName(flavour);
      if (n === expected) return 100;
      if (n === plainFlavour) return 95;
      const tokens = flavourTokens(flavour);
      if (!tokens.every((t) => n.includes(t))) return -1;
      let score = 60;
      if (n.includes("bc10000")) score += 25;
      if (n.includes("elfbar")) score += 10;
      if (String(item.status || "").toLowerCase() === "active") score += 2;
      if (Math.abs(Number(item.rate) - PRODUCT_PRICE_ZAR) <= PAYMENT_EPSILON) score += 3;
      return score;
    }
    __name(itemMatchScore, "itemMatchScore");
    async function getItemById(itemId) {
      const data = await zohoRequest(`/items/${encodeURIComponent(String(itemId))}?${organizationQuery()}`);
      return data.item || null;
    }
    __name(getItemById, "getItemById");
    async function listItems(query = {}) {
      const all = [];
      let page = 1;
      do {
        const data = await zohoRequest(`/items?${organizationQuery({ ...query, page: String(page), per_page: "200" })}`);
        if (Array.isArray(data.items)) all.push(...data.items);
        if (!data.page_context?.has_more_page) break;
        page += 1;
        if (page > 10) break;
      } while (true);
      return all;
    }
    __name(listItems, "listItems");
    async function getItemsByIds(itemIds) {
      const ids = [...new Set((itemIds || []).map(String).filter((id) => /^\d+$/.test(id)))];
      if (!ids.length) return [];
      try {
        const data = await zohoRequest(`/itemdetails?${organizationQuery({ item_ids: ids.join(",") })}`);
        return Array.isArray(data.items) ? data.items : [];
      } catch (_) {
        const items = [];
        for (const id of ids) items.push(await getItemById(id));
        return items;
      }
    }
    __name(getItemsByIds, "getItemsByIds");
    async function findExactItemByName(name) {
      const items = await listItems({ name });
      const target = normalizeItemName(name);
      const exact = items.filter((i) => normalizeItemName(i.name) === target && String(i.status || "").toLowerCase() === "active");
      if (exact.length !== 1) {
        const e = new Error(exact.length ? `Multiple active Zoho items are named \u201C${name}\u201D.` : `Active Zoho item \u201C${name}\u201D was not found.`);
        e.statusCode = 409;
        throw e;
      }
      const item = exact[0];
      return item.item_id ? await getItemById(item.item_id) || item : item;
    }
    __name(findExactItemByName, "findExactItemByName");
    function ownerInventoryItemMatchScore(item, spec) {
      if (!item || String(item.status || "active").toLowerCase() === "inactive") return -1;
      const targetSku = normalizeItemName(spec?.sku).replace(/\s+/g, "");
      const candidateSkuValues = [item?.sku, item?.item_code, item?.cf_sku, item?.name].map((value) => normalizeItemName(value).replace(/\s+/g, "")).filter(Boolean);
      if (targetSku && candidateSkuValues.some((value) => value === targetSku || value.includes(targetSku))) return 300;
      const itemName = normalizeItemName(item?.name);
      for (const hint of spec?.nameHints || []) {
        if (itemName && itemName === normalizeItemName(hint)) return 250;
      }
      const familyTokens = normalizeItemName(spec?.family).split(" ").filter(Boolean);
      const variantTokens = normalizeItemName(spec?.variant).split(" ").filter(Boolean);
      if (itemName && familyTokens.every((token) => itemName.includes(token)) && variantTokens.every((token) => itemName.includes(token))) return 180;
      return -1;
    }
    __name(ownerInventoryItemMatchScore, "ownerInventoryItemMatchScore");
    async function discoverOwnerInventoryCatalog(force = false) {
      const labels = Object.keys(OWNER_INVENTORY_PRODUCTS);
      const allResolved = labels.every((label) => resolvedOwnerInventoryItemIds.has(label));
      if (!force && allResolved && Date.now() < cachedOwnerInventoryCatalogUntil) return;
      if (!force && Date.now() < cachedOwnerInventoryCatalogUntil && resolvedOwnerInventoryItemIds.size) return;
      const candidates = (await listItems()).filter((item) => String(item.status || "active").toLowerCase() !== "inactive");
      ownerInventoryResolutionErrors.clear();
      for (const label of labels) {
        const spec = OWNER_INVENTORY_PRODUCTS[label];
        const ranked = candidates.map((item) => ({ item, score: ownerInventoryItemMatchScore(item, spec) })).filter((entry) => entry.score >= 180).sort((a, b) => b.score - a.score);
        if (!ranked.length) {
          resolvedOwnerInventoryItemIds.delete(label);
          ownerInventoryResolutionErrors.set(label, `Active Zoho item for ${spec.sku} (${label}) was not found.`);
          continue;
        }
        if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
          resolvedOwnerInventoryItemIds.delete(label);
          ownerInventoryResolutionErrors.set(label, `Multiple active Zoho items match ${spec.sku} (${label}).`);
          continue;
        }
        resolvedOwnerInventoryItemIds.set(label, String(ranked[0].item.item_id));
      }
      cachedOwnerInventoryCatalogUntil = Date.now() + (resolvedOwnerInventoryItemIds.size === labels.length ? PRODUCT_CATALOG_CACHE_MS : 5 * 60 * 1e3);
    }
    __name(discoverOwnerInventoryCatalog, "discoverOwnerInventoryCatalog");
    function buildOwnerInventorySnapshot(label, spec, item) {
      let locationState;
      try {
        locationState = chooseStockLocation(item, 1);
      } catch (error) {
        return {
          available: false, stock: 0, reason: cleanText(error?.message, 180) || "Zoho stock location could not be verified.",
          itemId: item?.item_id ? String(item.item_id) : null, itemName: item?.name || null, price: Number.isFinite(Number(item?.rate)) ? Number(item.rate) : null,
          locationId: null, locationName: null, stockSource: null, physicalStock: null,
          productFamily: spec.family, variant: spec.variant, sku: spec.sku, checkoutEnabled: spec.checkoutEnabled === true, expectedRetailPrice: spec.expectedRetailPrice
        };
      }
      const configured = Number.isFinite(Number(locationState?.available));
      const stock = configured ? Math.max(0, Math.floor(Number(locationState.available))) : 0;
      const active = String(item?.status || "active").toLowerCase() === "active";
      const physicalStock = Number.isFinite(Number(locationState?.physical)) ? Math.max(0, Math.floor(Number(locationState.physical))) : null;
      let reason = null;
      if (!active) reason = "Zoho item is inactive";
      else if (!configured) reason = "Stock quantity is not configured in Zoho Books";
      else if (stock <= 0) reason = "Out of stock";
      return {
        available: active && configured && stock > 0,
        stock, reason,
        itemId: item?.item_id ? String(item.item_id) : null,
        itemName: item?.name || null,
        price: Number.isFinite(Number(item?.rate)) ? Number(item.rate) : null,
        locationId: locationState?.locationId || null,
        locationName: locationState?.location?.location_name || locationState?.location?.name || null,
        stockSource: locationState?.stockSource || null,
        physicalStock,
        productFamily: spec.family, variant: spec.variant, sku: spec.sku, checkoutEnabled: spec.checkoutEnabled === true, expectedRetailPrice: spec.expectedRetailPrice
      };
    }
    __name(buildOwnerInventorySnapshot, "buildOwnerInventorySnapshot");
    async function getOwnerInventoryAvailability(forceStockRefresh = false, forceCatalogRefresh = false) {
      if (forceCatalogRefresh) {
        cachedProductCatalogUntil = 0;
        cachedOwnerInventoryCatalogUntil = 0;
      }
      try {
        await discoverProductCatalog(forceCatalogRefresh);
      } catch (error) {
        console.error("Zoho BC10000 catalogue discovery failed for owner inventory", { message: error.message });
      }
      try {
        await discoverOwnerInventoryCatalog(forceCatalogRefresh);
      } catch (error) {
        console.error("Zoho ELFA catalogue discovery failed for owner inventory", { message: error.message });
      }
      const bcFlavours = Object.keys(PRODUCT_NAMES);
      const ownerLabels = Object.keys(OWNER_INVENTORY_PRODUCTS);
      const allIds = [
        ...bcFlavours.map((flavour) => resolvedProductItemIds.get(flavour)),
        ...ownerLabels.map((label) => resolvedOwnerInventoryItemIds.get(label))
      ].filter(Boolean);
      let detailedItems = [];
      try {
        detailedItems = await getItemsByIds(allIds);
      } catch (error) {
        console.error("Zoho combined inventory detail lookup failed", { message: error.message });
      }
      const byId = new Map(detailedItems.filter(Boolean).map((item) => [String(item.item_id || ""), item]));
      const result = {};
      for (const flavour of bcFlavours) {
        const label = `BC10000 · ${flavour}`;
        try {
          const mappedId = resolvedProductItemIds.get(flavour);
          let item = mappedId ? byId.get(String(mappedId)) : null;
          if (!item) item = await resolveProductItem(flavour, false);
          if (!item?.item_id || itemMatchScore(item, flavour) < 60) throw Object.assign(new Error(`Zoho item mapping for ${flavour} could not be verified.`), { statusCode: 409 });
          resolvedProductItemIds.set(flavour, String(item.item_id));
          let snapshot = buildStockSnapshot(flavour, item, 1);
          if (snapshot.reason === "Stock quantity is not configured in Zoho Books") {
            const fullItem = await getItemById(item.item_id);
            if (fullItem) { item = fullItem; snapshot = buildStockSnapshot(flavour, item, 1); }
          }
          result[label] = {
            available: snapshot.available, stock: snapshot.stock, reason: snapshot.reason || (snapshot.available ? null : "Out of stock"),
            itemId: snapshot.itemId, itemName: snapshot.itemName, price: snapshot.price, locationId: snapshot.locationId, locationName: snapshot.locationName,
            stockSource: snapshot.stockSource || null, physicalStock: snapshot.physicalStock,
            productFamily: "BC10000", variant: flavour, sku: cleanText(item?.sku || item?.item_code, 80) || null, checkoutEnabled: true, expectedRetailPrice: PRODUCT_PRICE_ZAR
          };
        } catch (error) {
          result[label] = { available: false, stock: 0, reason: error.statusCode === 409 ? error.message : "Zoho stock lookup failed", itemId: resolvedProductItemIds.get(flavour) || null, itemName: null, price: null, productFamily: "BC10000", variant: flavour, sku: null, checkoutEnabled: true, expectedRetailPrice: PRODUCT_PRICE_ZAR };
        }
      }
      for (const label of ownerLabels) {
        const spec = OWNER_INVENTORY_PRODUCTS[label];
        try {
          const mappedId = resolvedOwnerInventoryItemIds.get(label);
          if (!mappedId) throw Object.assign(new Error(ownerInventoryResolutionErrors.get(label) || `Zoho item mapping for ${label} is not available.`), { statusCode: 409 });
          let item = byId.get(String(mappedId));
          if (!item) item = await getItemById(mappedId);
          if (!item?.item_id || ownerInventoryItemMatchScore(item, spec) < 180) throw Object.assign(new Error(`Zoho item mapping for ${label} could not be verified.`), { statusCode: 409 });
          resolvedOwnerInventoryItemIds.set(label, String(item.item_id));
          let snapshot = buildOwnerInventorySnapshot(label, spec, item);
          if (snapshot.reason === "Stock quantity is not configured in Zoho Books") {
            const fullItem = await getItemById(item.item_id);
            if (fullItem) snapshot = buildOwnerInventorySnapshot(label, spec, fullItem);
          }
          result[label] = snapshot;
        } catch (error) {
          result[label] = { available: false, stock: 0, reason: cleanText(error?.message, 180) || "Zoho stock lookup failed", itemId: resolvedOwnerInventoryItemIds.get(label) || null, itemName: null, price: null, productFamily: spec.family, variant: spec.variant, sku: spec.sku, checkoutEnabled: false, expectedRetailPrice: spec.expectedRetailPrice };
        }
      }
      return result;
    }
    __name(getOwnerInventoryAvailability, "getOwnerInventoryAvailability");
    async function getPublicInventoryCatalogue(forceStockRefresh = false, forceCatalogRefresh = false) {
      const [bcAvailability, elfaAvailability] = await Promise.all([
        getProductAvailability(forceStockRefresh, forceCatalogRefresh, true),
        getOwnerInventoryAvailability(forceStockRefresh, forceCatalogRefresh)
      ]);
      const catalogue = {};
      for (const [flavour, state] of Object.entries(bcAvailability || {})) {
        const productKey = BC_CHECKOUT_KEYS_BY_FLAVOUR[flavour];
        const spec = CHECKOUT_PRODUCTS[productKey];
        if (!spec) continue;
        catalogue[productKey] = {
          productKey,
          productFamily: spec.family,
          variant: spec.variant,
          displayName: spec.displayName,
          unitPrice: Number(spec.unitPrice),
          available: state?.available === true,
          stock: Math.max(0, Math.floor(Number(state?.stock || 0))),
          itemId: cleanText(state?.itemId || state?.item_id, 80) || null,
          reason: cleanText(state?.reason, 180) || null,
          checkoutEnabled: true
        };
      }
      for (const [label, state] of Object.entries(elfaAvailability || {})) {
        const ownerSpec = OWNER_INVENTORY_PRODUCTS[label];
        const productKey = CHECKOUT_PRODUCT_KEYS.find((key) => CHECKOUT_PRODUCTS[key]?.inventoryLabel === label);
        const spec = productKey ? CHECKOUT_PRODUCTS[productKey] : null;
        if (!ownerSpec || !spec) continue;
        const itemId = cleanText(state?.itemId || state?.item_id, 80) || null;
        let adjusted = state;
        if (itemId && Number.isFinite(Number(state?.stock))) {
          try {
            adjusted = await applyWebsiteReservationOverlay({
              ...state,
              requestedQuantity: 1,
              canFulfil: state?.available === true && Number(state?.stock || 0) >= 1
            }, itemId);
          } catch (_) {
            adjusted = { ...state, available: false, stock: 0, reason: "Website stock reservation state could not be verified." };
          }
        }
        const priceMatches = Number.isFinite(Number(adjusted?.price)) && Math.abs(Number(adjusted.price) - Number(spec.unitPrice)) <= PAYMENT_EPSILON;
        catalogue[productKey] = {
          productKey,
          productFamily: spec.family,
          variant: spec.variant,
          displayName: spec.displayName,
          unitPrice: Number(spec.unitPrice),
          available: adjusted?.available === true && priceMatches && ownerSpec.checkoutEnabled === true,
          stock: Math.max(0, Math.floor(Number(adjusted?.stock || 0))),
          itemId,
          reason: !priceMatches ? `Zoho item price does not match R${Number(spec.unitPrice).toFixed(2)}` : cleanText(adjusted?.reason, 180) || null,
          checkoutEnabled: ownerSpec.checkoutEnabled === true && priceMatches
        };
      }
      return catalogue;
    }
    __name(getPublicInventoryCatalogue, "getPublicInventoryCatalogue");

    async function discoverProductCatalog(force = false) {
      const allResolved = Object.keys(PRODUCT_NAMES).every((f) => resolvedProductItemIds.has(f));
      if (!force && allResolved && Date.now() < cachedProductCatalogUntil) return;
      for (const flavour of Object.keys(PRODUCT_NAMES)) {
        const envName = PRODUCT_ITEM_ID_ENVS[flavour];
        const configuredId = envName ? String(runtimeEnv(envName) || "").trim() : "";
        if (!configuredId) continue;
        const item = await getItemById(configuredId);
        if (!item || itemMatchScore(item, flavour) < 60) {
          const e = new Error(`Configured Zoho item ID for ${flavour} does not match that BC10000 flavour.`);
          e.statusCode = 409;
          throw e;
        }
        resolvedProductItemIds.set(flavour, String(item.item_id));
      }
      const unresolved = Object.keys(PRODUCT_NAMES).filter((f) => !resolvedProductItemIds.has(f));
      if (!unresolved.length) {
        cachedProductCatalogUntil = Date.now() + PRODUCT_CATALOG_CACHE_MS;
        return;
      }
      let candidates = (await listItems({ name_contains: "BC10000" })).filter((item) => String(item.status || "").toLowerCase() === "active");
      if (!candidates.length || unresolved.some((flavour) => !candidates.some((item) => itemMatchScore(item, flavour) >= 60))) {
        const allActive = (await listItems()).filter((item) => String(item.status || "").toLowerCase() === "active");
        const seen = new Set(candidates.map((i) => String(i.item_id)));
        for (const item of allActive) if (!seen.has(String(item.item_id))) candidates.push(item);
      }
      for (const flavour of unresolved) {
        const ranked = candidates.map((item) => ({ item, score: itemMatchScore(item, flavour) })).filter((x) => x.score >= 60).sort((a, b) => b.score - a.score);
        if (!ranked.length) continue;
        if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
          const e = new Error(`Multiple Zoho items could represent ${flavour}. Pin the correct item ID in Netlify.`);
          e.statusCode = 409;
          throw e;
        }
        resolvedProductItemIds.set(flavour, String(ranked[0].item.item_id));
      }
      cachedProductCatalogUntil = Date.now() + PRODUCT_CATALOG_CACHE_MS;
    }
    __name(discoverProductCatalog, "discoverProductCatalog");
    async function resolveProductItem(flavour, forceDiscovery = false) {
      if (!PRODUCT_NAMES[flavour]) {
        const e = new Error("Unknown BC10000 flavour.");
        e.statusCode = 400;
        throw e;
      }
      await discoverProductCatalog(forceDiscovery);
      const itemId = resolvedProductItemIds.get(flavour);
      if (!itemId) {
        for (const name of [PRODUCT_NAMES[flavour], flavour]) {
          try {
            const item2 = await findExactItemByName(name);
            if (item2?.item_id && itemMatchScore(item2, flavour) >= 60) {
              resolvedProductItemIds.set(flavour, String(item2.item_id));
              return item2;
            }
          } catch (_) {
          }
        }
        const e = new Error(`No active Zoho Books Item could be mapped to ${flavour}.`);
        e.statusCode = 409;
        throw e;
      }
      let item = null;
      try {
        item = await getItemById(itemId);
      } catch (error) {
        resolvedProductItemIds.delete(flavour);
        cachedProductCatalogUntil = 0;
        if (!forceDiscovery) return resolveProductItem(flavour, true);
        throw error;
      }
      if (!item || itemMatchScore(item, flavour) < 60) {
        resolvedProductItemIds.delete(flavour);
        cachedProductCatalogUntil = 0;
        if (!forceDiscovery) return resolveProductItem(flavour, true);
        const e = new Error(`Zoho item mapping for ${flavour} is no longer valid.`);
        e.statusCode = 409;
        throw e;
      }
      return item;
    }
    __name(resolveProductItem, "resolveProductItem");
    async function getProductAvailability(forceStockRefresh = false, forceCatalogRefresh = false, includeWebsiteReservations = false) {
      if (!forceStockRefresh && cachedAvailability && Date.now() < cachedAvailabilityUntil) {
        return includeWebsiteReservations ? applyAvailabilityReservations(cachedAvailability) : cachedAvailability;
      }
      if (forceCatalogRefresh) cachedProductCatalogUntil = 0;
      try {
        await discoverProductCatalog(forceCatalogRefresh);
      } catch (error) {
        console.error("Zoho BC10000 catalogue discovery failed", { message: error.message });
      }
      const flavours = Object.keys(PRODUCT_NAMES);
      const resolvedIds = flavours.map((f) => resolvedProductItemIds.get(f)).filter(Boolean);
      let detailedItems = [];
      try {
        detailedItems = await getItemsByIds(resolvedIds);
      } catch (error) {
        console.error("Zoho bulk item detail lookup failed", { message: error.message });
      }
      const byId = new Map(detailedItems.filter(Boolean).map((item) => [String(item.item_id || ""), item]));
      const result = {};
      for (const flavour of flavours) {
        try {
          const mappedId = resolvedProductItemIds.get(flavour);
          let item = mappedId ? byId.get(String(mappedId)) : null;
          if (!item) item = await resolveProductItem(flavour, false);
          if (!item?.item_id || itemMatchScore(item, flavour) < 60) throw Object.assign(new Error(`Zoho item mapping for ${flavour} could not be verified.`), { statusCode: 409 });
          resolvedProductItemIds.set(flavour, String(item.item_id));
          let snapshot = buildStockSnapshot(flavour, item, 1);
          if (snapshot.reason === "Stock quantity is not configured in Zoho Books") {
            const fullItem = await getItemById(item.item_id);
            if (fullItem) {
              item = fullItem;
              snapshot = buildStockSnapshot(flavour, item, 1);
            }
          }
          result[flavour] = {
            available: snapshot.available,
            stock: snapshot.stock,
            reason: snapshot.reason || (snapshot.available ? null : "Out of stock"),
            itemId: snapshot.itemId,
            itemName: snapshot.itemName,
            price: snapshot.price,
            locationId: snapshot.locationId,
            locationName: snapshot.locationName,
            stockSource: snapshot.stockSource || null,
            physicalStock: snapshot.physicalStock
          };
        } catch (error) {
          result[flavour] = { available: false, stock: 0, reason: error.statusCode === 409 ? error.message : "Zoho stock lookup failed", itemId: resolvedProductItemIds.get(flavour) || null, itemName: null, price: null };
        }
      }
      const states = Object.values(result);
      const infrastructureFailures = states.filter((state) => state.reason === "Zoho stock lookup failed").length;
      if (states.length && infrastructureFailures === states.length) {
        const e = new Error("Live Zoho stock could not be read.");
        e.statusCode = 503;
        e.retryAfter = "2";
        throw e;
      }
      cachedAvailability = result;
      cachedAvailabilityUntil = Date.now() + AVAILABILITY_CACHE_MS;
      return includeWebsiteReservations ? applyAvailabilityReservations(result) : result;
    }
    __name(getProductAvailability, "getProductAvailability");
    async function applyAvailabilityReservations(availability) {
      const output = {};
      for (const [flavour, state] of Object.entries(availability || {})) {
        const itemId = String(state?.itemId || "");
        if (!itemId || !Number.isFinite(Number(state?.stock))) {
          output[flavour] = state;
          continue;
        }
        try {
          const snapshot = {
            ...state,
            requestedQuantity: 1,
            canFulfil: state.available === true && Number(state.stock) >= 1,
            physicalStock: state.physicalStock
          };
          const adjusted = await applyWebsiteReservationOverlay(snapshot, itemId);
          output[flavour] = {
            ...state,
            available: adjusted.available,
            stock: adjusted.stock,
            reason: adjusted.reason || state.reason,
            websiteReserved: adjusted.websiteReserved || 0,
            ownerExcluded: adjusted.ownerExcluded || 0
          };
        } catch (error) {
          output[flavour] = { ...state, available: false, stock: 0, reason: "Website stock reservation state could not be verified." };
        }
      }
      return output;
    }
    __name(applyAvailabilityReservations, "applyAvailabilityReservations");
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
          reason: error.message
        };
      }
      const stock = locationState.available;
      const active = String(item?.status || "").toLowerCase() === "active";
      const priceMatches = Math.abs(Number(item?.rate) - PRODUCT_PRICE_ZAR) <= PAYMENT_EPSILON;
      const configured = stock !== null;
      const wholeStock = configured ? Math.max(0, Math.floor(stock)) : 0;
      const physicalStock = locationState.physical === null ? null : Math.max(0, Math.floor(Number(locationState.physical)));
      let reason = null;
      if (!active) reason = "Item inactive in Zoho Books";
      else if (!priceMatches) reason = "Zoho item price does not match R300.00";
      else if (!configured) reason = "Stock quantity is not configured in Zoho Books";
      else if (wholeStock < requestedQuantity) reason = `Only ${wholeStock} unit(s) are currently available.`;
      return {
        flavour,
        itemId: item?.item_id ? String(item.item_id) : null,
        itemName: item?.name || null,
        available: active && priceMatches && configured && wholeStock > 0,
        canFulfil: active && priceMatches && configured && wholeStock >= requestedQuantity,
        stock: wholeStock,
        physicalStock,
        stockSignals: collectStockSignals(item, locationState.locationId || ""),
        stockSource: locationState.stockSource || null,
        requestedQuantity,
        price: Number(item?.rate),
        locationId: locationState.locationId || null,
        locationName: locationState.location?.location_name || null,
        reason
      };
    }
    __name(buildStockSnapshot, "buildStockSnapshot");
    async function resolveSelectedProductItem(flavour, expectedItemId = "", forceFresh = false) {
      const supplied = String(expectedItemId || "").trim();
      if (supplied) {
        if (!/^\d+$/.test(supplied)) {
          const e = new TypeError("Invalid Zoho item identifier.");
          e.statusCode = 400;
          throw e;
        }
        let item = null;
        try {
          item = await getItemById(supplied);
        } catch (error) {
          const e = new Error("The selected Zoho Books Item no longer exists. Please refresh the shop stock and select the flavour again.");
          e.statusCode = 409;
          e.freshAvailabilityNeeded = true;
          throw e;
        }
        if (!item || itemMatchScore(item, flavour) < 60) {
          const e = new Error("The selected product no longer matches the Zoho Books item catalogue. Please refresh the shop.");
          e.statusCode = 409;
          throw e;
        }
        resolvedProductItemIds.set(flavour, String(item.item_id));
        return item;
      }
      return resolveProductItem(flavour, forceFresh);
    }
    __name(resolveSelectedProductItem, "resolveSelectedProductItem");
    async function checkExactStock(flavour, quantity, forceFresh = false, expectedItemId = "") {
      if (!ALLOWED_FLAVOURS.has(flavour)) {
        const e = new TypeError("A valid BC10000 flavour is required.");
        e.statusCode = 400;
        throw e;
      }
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) {
        const e = new TypeError("Quantity must be between 1 and 5.");
        e.statusCode = 400;
        throw e;
      }
      if (forceFresh) cachedAvailabilityUntil = 0;
      let item = await resolveSelectedProductItem(flavour, expectedItemId, forceFresh);
      let snapshot = buildStockSnapshot(flavour, item, qty);
      if ((!snapshot.itemId || snapshot.reason === "Stock quantity is not configured in Zoho Books") && !expectedItemId && !forceFresh) {
        item = await resolveProductItem(flavour, true);
        snapshot = buildStockSnapshot(flavour, item, qty);
      }
      return { item, snapshot };
    }
    __name(checkExactStock, "checkExactStock");
    async function requireStockState(flavour, quantity, expectedItemId = "") {
      const { item, snapshot } = await checkExactStock(flavour, quantity, true, expectedItemId);
      if (!snapshot.canFulfil) {
        const detail = snapshot.reason || "This product is not currently available.";
        const message = snapshot.stock === 0 ? "This flavour has just been purchased by another customer and is now out of stock." : Number(snapshot.stock) < Number(quantity) ? `Only ${snapshot.stock} unit(s) remain after a recent purchase. Please lower the quantity or choose another flavour.` : detail;
        const e = new Error(message);
        e.statusCode = 409;
        e.freshAvailabilityNeeded = true;
        throw e;
      }
      return { item, snapshot };
    }
    __name(requireStockState, "requireStockState");
    function buildCheckoutStockSnapshot(spec, item, quantity = 1) {
      const requestedQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0 ? Number(quantity) : 1;
      let locationState;
      try {
        locationState = chooseStockLocation(item, requestedQuantity);
      } catch (error) {
        return {
          productKey: null,
          productFamily: spec.family,
          variant: spec.variant,
          displayName: spec.displayName,
          flavour: spec.variant,
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
          unitPrice: Number(spec.unitPrice),
          locationId: null,
          locationName: null,
          reason: error.message
        };
      }
      const stock = locationState.available;
      const active = String(item?.status || "").toLowerCase() === "active";
      const priceMatches = Number.isFinite(Number(item?.rate)) && Math.abs(Number(item.rate) - Number(spec.unitPrice)) <= PAYMENT_EPSILON;
      const configured = stock !== null;
      const wholeStock = configured ? Math.max(0, Math.floor(Number(stock))) : 0;
      const physicalStock = locationState.physical === null ? null : Math.max(0, Math.floor(Number(locationState.physical)));
      let reason = null;
      if (!active) reason = "Item inactive in Zoho Books";
      else if (!priceMatches) reason = `Zoho item price does not match R${Number(spec.unitPrice).toFixed(2)}`;
      else if (!configured) reason = "Stock quantity is not configured in Zoho Books";
      else if (wholeStock < requestedQuantity) reason = `Only ${wholeStock} unit(s) are currently available.`;
      return {
        productKey: null,
        productFamily: spec.family,
        variant: spec.variant,
        displayName: spec.displayName,
        flavour: spec.variant,
        itemId: item?.item_id ? String(item.item_id) : null,
        itemName: item?.name || null,
        available: active && priceMatches && configured && wholeStock > 0,
        canFulfil: active && priceMatches && configured && wholeStock >= requestedQuantity,
        stock: wholeStock,
        physicalStock,
        stockSignals: collectStockSignals(item, locationState.locationId || ""),
        stockSource: locationState.stockSource || null,
        requestedQuantity,
        price: Number(item?.rate),
        unitPrice: Number(spec.unitPrice),
        locationId: locationState.locationId || null,
        locationName: locationState.location?.location_name || locationState.location?.name || null,
        reason
      };
    }
    __name(buildCheckoutStockSnapshot, "buildCheckoutStockSnapshot");
    async function requireCheckoutStockState(line) {
      const productKey = checkoutProductKeyFromInput(line);
      const spec = checkoutProductDefinition(productKey);
      if (!spec || !checkoutProductEnabled(spec)) {
        const e = new TypeError("This product is not enabled for checkout.");
        e.statusCode = 400;
        throw e;
      }
      if (spec.family === "BC10000") {
        const result = await requireStockState(spec.variant, line.quantity, line.itemId);
        return {
          item: result.item,
          snapshot: {
            ...result.snapshot,
            productKey,
            productFamily: spec.family,
            variant: spec.variant,
            displayName: spec.displayName,
            unitPrice: Number(spec.unitPrice)
          }
        };
      }
      const ownerSpec = OWNER_INVENTORY_PRODUCTS[spec.inventoryLabel];
      if (!ownerSpec || ownerSpec.checkoutEnabled !== true) {
        const e = new Error("This ELFA product has not been enabled for checkout.");
        e.statusCode = 409;
        throw e;
      }
      await discoverOwnerInventoryCatalog(false);
      const mappedId = String(resolvedOwnerInventoryItemIds.get(spec.inventoryLabel) || "");
      const expectedItemId = String(line.itemId || "").trim();
      if (!mappedId || !/^\d+$/.test(mappedId)) {
        const e = new Error(`Zoho item mapping for ${spec.displayName} is not available.`);
        e.statusCode = 409;
        e.freshAvailabilityNeeded = true;
        throw e;
      }
      if (!/^\d+$/.test(expectedItemId) || expectedItemId !== mappedId) {
        const e = new Error(`${spec.displayName} no longer matches the verified Zoho item catalogue. Please refresh the shop.`);
        e.statusCode = 409;
        e.freshAvailabilityNeeded = true;
        throw e;
      }
      const item = await getItemById(mappedId);
      if (!item?.item_id || ownerInventoryItemMatchScore(item, ownerSpec) < 180) {
        const e = new Error(`Zoho item mapping for ${spec.displayName} could not be verified.`);
        e.statusCode = 409;
        e.freshAvailabilityNeeded = true;
        throw e;
      }
      const snapshot = {
        ...buildCheckoutStockSnapshot(spec, item, line.quantity),
        productKey
      };
      if (!snapshot.canFulfil) {
        const detail = snapshot.reason || "This product is not currently available.";
        const message = snapshot.stock === 0 ? `${spec.displayName} is now out of stock.` : Number(snapshot.stock) < Number(line.quantity) ? `Only ${snapshot.stock} unit(s) of ${spec.displayName} remain. Please lower the quantity.` : detail;
        const e = new Error(message);
        e.statusCode = 409;
        e.freshAvailabilityNeeded = true;
        throw e;
      }
      return { item, snapshot };
    }
    __name(requireCheckoutStockState, "requireCheckoutStockState");
    async function findCustomerByEmail(email) {
      const data = await zohoRequest(`/contacts?${organizationQuery({ contact_type: "customer", email, per_page: "2" })}`);
      const contacts = Array.isArray(data.contacts) ? data.contacts : [];
      const exact = contacts.filter((c) => String(c.email || "").trim().toLowerCase() === email);
      if (exact.length > 1) {
        const e = new Error("Multiple Zoho customers use this email. Resolve duplicates in Zoho Books.");
        e.statusCode = 409;
        throw e;
      }
      return exact[0] || null;
    }
    __name(findCustomerByEmail, "findCustomerByEmail");
    async function createCustomer(order) {
      const data = await zohoRequest(`/contacts?${organizationQuery()}`, { method: "POST", body: { contact_name: order.customerName, contact_type: "customer", billing_address: buildBillingAddress(order), contact_persons: [buildPrimaryPerson(order)] } });
      return data.contact;
    }
    __name(createCustomer, "createCustomer");
    async function updateCustomer(existing, order) {
      const contactId = String(existing.contact_id || "");
      const currentData = await zohoRequest(`/contacts/${encodeURIComponent(contactId)}?${organizationQuery()}`);
      const current = currentData.contact || {};
      const persons = Array.isArray(current.contact_persons) ? current.contact_persons : [];
      const primary = persons.find((p) => p.is_primary_contact) || persons.find((p) => String(p.email || "").trim().toLowerCase() === order.email) || null;
      const preserved = persons.filter((p) => String(p.contact_person_id || "") !== String(primary?.contact_person_id || "")).map((p) => ({ contact_person_id: p.contact_person_id, first_name: p.first_name || "", last_name: p.last_name || "", email: p.email || "", phone: p.phone || "", mobile: p.mobile || "", is_primary_contact: false }));
      const body = { contact_name: order.customerName, contact_type: "customer", billing_address: buildBillingAddress(order), contact_persons: [buildPrimaryPerson(order, primary?.contact_person_id), ...preserved] };
      if (current.shipping_address) body.shipping_address = current.shipping_address;
      const data = await zohoRequest(`/contacts/${encodeURIComponent(contactId)}?${organizationQuery()}`, { method: "PUT", body });
      return data.contact || current;
    }
    __name(updateCustomer, "updateCustomer");
    async function syncCustomer(order) {
      const existing = await findCustomerByEmail(order.email);
      return existing ? updateCustomer(existing, order) : createCustomer(order);
    }
    __name(syncCustomer, "syncCustomer");
    function todayISO() {
      return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    }
    __name(todayISO, "todayISO");
    function futureDateISO(days) {
      const d = /* @__PURE__ */ new Date();
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    }
    __name(futureDateISO, "futureDateISO");
    function webReference(checkoutId) {
      return `WEB-${checkoutId}`.slice(0, 100);
    }
    __name(webReference, "webReference");
    function isVoidedStatus(status) {
      return ["void", "voided", "cancelled", "canceled"].includes(String(status || "").toLowerCase());
    }
    __name(isVoidedStatus, "isVoidedStatus");
    function assertDirectInvoiceMatches(invoice, order, customer, reference) {
      if (!invoice?.invoice_id) {
        const e = new Error("Recovered Zoho invoice is incomplete.");
        e.statusCode = 409;
        throw e;
      }
      if (isVoidedStatus(invoice.status)) {
        const e = new Error("Recovered Zoho invoice has been voided.");
        e.statusCode = 409;
        throw e;
      }
      if (String(invoice.reference_number || "") !== String(reference)) {
        const e = new Error("Recovered invoice reference does not match this checkout.");
        e.statusCode = 409;
        throw e;
      }
      if (customer?.contact_id && String(invoice.customer_id || "") !== String(customer.contact_id)) {
        const e = new Error("Recovered invoice belongs to a different customer. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      const lines = Array.isArray(invoice.line_items) ? invoice.line_items : [];
      const productLines = lines.filter((line) => String(line.item_id || "") === String(order.itemId));
      if (productLines.length !== 1 || Math.abs(Number(productLines[0].quantity) - Number(order.quantity)) > PAYMENT_EPSILON || Math.abs(Number(productLines[0].rate) - PRODUCT_PRICE_ZAR) > PAYMENT_EPSILON) {
        const e = new Error("Recovered invoice product details do not match this checkout. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      if (Math.abs(Number(invoice.shipping_charge || 0) - DELIVERY_PRICE_ZAR) > PAYMENT_EPSILON) {
        const e = new Error("Recovered invoice shipping charge does not match the fixed R60.00 website delivery fee. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      return invoice;
    }
    __name(assertDirectInvoiceMatches, "assertDirectInvoiceMatches");
    async function findRecoverableDirectInvoice(order, customer, reference, progress = {}) {
      if (progress.invoiceId) {
        try {
          const invoice = await getInvoice(progress.invoiceId);
          if (invoice?.invoice_id && !isVoidedStatus(invoice.status)) return assertDirectInvoiceMatches(invoice, order, customer, reference);
        } catch (error) {
          if (error.statusCode === 409) throw error;
        }
      }
      const data = await zohoRequest(`/invoices?${organizationQuery({ customer_id: String(customer.contact_id), per_page: "100" })}`);
      const summaries = (Array.isArray(data.invoices) ? data.invoices : []).filter(
        (inv) => String(inv.reference_number || "") === String(reference) && !isVoidedStatus(inv.status)
      );
      if (summaries.length > 1) {
        const e = new Error("Multiple active Zoho invoices exist for this checkout reference. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      if (!summaries.length) return null;
      return assertDirectInvoiceMatches(await getInvoice(summaries[0].invoice_id), order, customer, reference);
    }
    __name(findRecoverableDirectInvoice, "findRecoverableDirectInvoice");
    async function createDirectInvoice(order, customer, productItem, reference, stockSnapshot) {
      const locationId = String(stockSnapshot?.locationId || "").trim();
      const productLine = { item_id: String(productItem.item_id), rate: PRODUCT_PRICE_ZAR, quantity: order.quantity };
      if (locationId) productLine.location_id = locationId;
      const expiresAt = new Date(Date.now() + CHECKOUT_TOKEN_LIFETIME_MS).toISOString();
      const payload = {
        customer_id: String(customer.contact_id),
        date: todayISO(),
        reference_number: reference,
        shipping_charge: DELIVERY_PRICE_ZAR,
        allow_partial_payments: false,
        ...locationId ? { location_id: locationId } : {},
        line_items: [productLine],
        payment_options: { payment_gateways: [{ configured: true, additional_field1: "standard", gateway_name: "paypal" }] },
        notes: `Vestige website checkout. FULL PAYMENT ONLY. Delivery: ${DELIVERY_METHOD_NAME}. Courier Locker: ${order.courierLocker}. Selected flavour: ${order.flavour}. Unpaid checkout expires at ${expiresAt}.`
      };
      const data = await zohoRequest(`/invoices?${organizationQuery()}`, { method: "POST", body: payload });
      return data.invoice;
    }
    __name(createDirectInvoice, "createDirectInvoice");
    async function updateInvoiceControls(invoiceId, reference, courierLocker) {
      const expiresAt = new Date(Date.now() + CHECKOUT_TOKEN_LIFETIME_MS).toISOString();
      const body = {
        allow_partial_payments: false,
        reference_number: reference,
        notes: `Vestige website checkout. FULL PAYMENT ONLY. Courier Locker: ${courierLocker}. Unpaid checkout expires at ${expiresAt}.`
      };
      const data = await zohoRequest(`/invoices/${encodeURIComponent(invoiceId)}?${organizationQuery()}`, { method: "PUT", body });
      return data.invoice;
    }
    __name(updateInvoiceControls, "updateInvoiceControls");
    async function voidInvoice(invoiceId) {
      try {
        await zohoRequest(`/invoices/${encodeURIComponent(invoiceId)}/status/void?${organizationQuery()}`, { method: "POST" });
      } catch (error) {
        console.error("Failed to void invoice during rollback", { invoiceId: String(invoiceId), message: error.message });
      }
    }
    __name(voidInvoice, "voidInvoice");
    async function markInvoiceSent(invoiceId) {
      await zohoRequest(`/invoices/${encodeURIComponent(invoiceId)}/status/sent?${organizationQuery()}`, { method: "POST" });
      const invoice = await getInvoice(invoiceId);
      const status = String(invoice.status || "").toLowerCase();
      if (!["sent", "overdue", "paid"].includes(status)) {
        const e = new Error("Zoho did not confirm the invoice as Sent.");
        e.statusCode = 409;
        throw e;
      }
      return invoice;
    }
    __name(markInvoiceSent, "markInvoiceSent");
    function isPaypalConfigured(invoice) {
      const gateways = Array.isArray(invoice?.payment_options?.payment_gateways) ? invoice.payment_options.payment_gateways : [];
      return gateways.some((g) => String(g.gateway_name || "").toLowerCase() === "paypal" && g.configured === true);
    }
    __name(isPaypalConfigured, "isPaypalConfigured");
    function isAllowedPaymentHostname(hostname) {
      const host = String(hostname || "").toLowerCase();
      if (!host) return false;
      if (ALLOWED_PAYMENT_HOSTS.has(host)) return true;
      for (const allowed of ALLOWED_PAYMENT_HOSTS) {
        if (host.endsWith("." + allowed)) return true;
      }
      return false;
    }
    __name(isAllowedPaymentHostname, "isAllowedPaymentHostname");
    function validatePaymentUrl(raw) {
      let url;
      try {
        url = new URL(String(raw || ""));
      } catch {
        throw Object.assign(new Error("Zoho returned an invalid payment URL."), { statusCode: 409 });
      }
      if (url.protocol !== "https:" || !isAllowedPaymentHostname(url.hostname)) {
        const e = new Error("Zoho returned an unapproved payment URL.");
        e.statusCode = 409;
        throw e;
      }
      return url.toString();
    }
    __name(validatePaymentUrl, "validatePaymentUrl");
    async function getInvoice(invoiceId) {
      const data = await zohoRequest(`/invoices/${encodeURIComponent(invoiceId)}?${organizationQuery()}`);
      return data.invoice || {};
    }
    __name(getInvoice, "getInvoice");
    async function generatePaymentLink(invoiceId) {
      const data = await zohoRequest(`/share/paymentlink?${organizationQuery({ transaction_id: String(invoiceId), transaction_type: "invoice", link_type: "public", expiry_time: futureDateISO(1) })}`);
      return data.data?.share_link || null;
    }
    __name(generatePaymentLink, "generatePaymentLink");
    async function allocateBankPaymentReference() {
      const store = getD1Store("vestige-order-sequence");
      const key = "bank-order";
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
        const currentValue = Number(current?.data?.value || 0);
        if (!Number.isSafeInteger(currentValue) || currentValue < 0) {
          const e2 = new Error("Order reference sequence is invalid.");
          e2.statusCode = 503;
          e2.service = "checkout_storage";
          throw e2;
        }
        const nextValue = currentValue + 1;
        if (nextValue > 99999999) {
          const e2 = new Error("Order reference sequence is exhausted.");
          e2.statusCode = 503;
          e2.service = "checkout_storage";
          throw e2;
        }
        const payload = { value: nextValue, updatedAt: Date.now() };
        const result = current ? await store.setJSON(key, payload, { onlyIfMatch: current.etag }) : await store.setJSON(key, payload, { onlyIfNew: true });
        if (result?.modified) return `V${String(nextValue).padStart(4, "0")}`;
        await new Promise((resolve) => setTimeout(resolve, 10 + attempt * 8));
      }
      const e = new Error("Unable to allocate a unique order reference safely.");
      e.statusCode = 503;
      e.service = "checkout_storage";
      e.retryAfter = "2";
      throw e;
    }
    __name(allocateBankPaymentReference, "allocateBankPaymentReference");
    function publicEftDetails() {
      const pick = /* @__PURE__ */ __name((name) => cleanText(runtimeEnv(name), 120), "pick");
      const details = {
        bankName: pick("EFT_BANK_NAME"),
        accountHolder: pick("EFT_ACCOUNT_HOLDER"),
        accountNumber: pick("EFT_ACCOUNT_NUMBER"),
        accountType: pick("EFT_ACCOUNT_TYPE"),
        branchCode: pick("EFT_BRANCH_CODE"),
        swiftCode: pick("EFT_SWIFT_CODE")
      };
      return {
        available: Boolean(details.bankName && details.accountHolder && details.accountNumber),
        ...details
      };
    }
    __name(publicEftDetails, "publicEftDetails");
    function paymentAdminSecret() {
      const secret = requireEnv("VESTIGE_PAYMENT_ADMIN_KEY");
      if (Buffer.byteLength(secret, "utf8") < 32) {
        const e = new Error("VESTIGE_PAYMENT_ADMIN_KEY must contain at least 32 bytes of unpredictable server-only data.");
        e.statusCode = 503;
        throw e;
      }
      return secret;
    }
    __name(paymentAdminSecret, "paymentAdminSecret");
    function requirePaymentAdmin(event) {
      const supplied = event.headers?.["x-vestige-payment-admin-key"] || event.headers?.["X-Vestige-Payment-Admin-Key"];
      if (!safeEqual(supplied, paymentAdminSecret())) {
        const e = new Error("Unauthorized.");
        e.statusCode = 401;
        throw e;
      }
    }
    __name(requirePaymentAdmin, "requirePaymentAdmin");
    function validatePaymentReference(value) {
      const ref = cleanText(value, 24).toUpperCase();
      if (!/^V\d{4,8}$/.test(ref)) {
        const e = new TypeError("A valid Vestige payment reference is required.");
        e.statusCode = 400;
        throw e;
      }
      return ref;
    }
    __name(validatePaymentReference, "validatePaymentReference");
    function validatePaymentDate(value) {
      const date = cleanText(value, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const e = new TypeError("Payment date must use YYYY-MM-DD.");
        e.statusCode = 400;
        throw e;
      }
      const parsed = /* @__PURE__ */ new Date(`${date}T00:00:00Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        const e = new TypeError("Payment date is invalid.");
        e.statusCode = 400;
        throw e;
      }
      const tomorrow = /* @__PURE__ */ new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      if (parsed.getTime() >= tomorrow.getTime()) {
        const e = new TypeError("Payment date cannot be in the future.");
        e.statusCode = 400;
        throw e;
      }
      return date;
    }
    __name(validatePaymentDate, "validatePaymentDate");
    async function indexBankPaymentReference(paymentReference, checkoutId) {
      const store = getD1Store("vestige-bank-payment-reference-index");
      const key = String(paymentReference);
      const payload = { checkoutId: String(checkoutId), paymentReference: key, updatedAt: Date.now() };
      const created = await store.setJSON(key, payload, { onlyIfNew: true });
      if (created?.modified) return;
      const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
      if (current && String(current.data?.checkoutId || "") === String(checkoutId)) return;
      const e = new Error("Payment reference index conflict. Manual review is required.");
      e.statusCode = 409;
      throw e;
    }
    __name(indexBankPaymentReference, "indexBankPaymentReference");
    async function locateBankCheckoutByReference(paymentReference) {
      const ref = validatePaymentReference(paymentReference);
      const indexStore = getD1Store("vestige-bank-payment-reference-index");
      const indexed = await indexStore.getWithMetadata(ref, { type: "json", consistency: "strong" });
      if (indexed?.data?.checkoutId) {
        const store = await getCheckoutStore();
        const key = `checkout-${String(indexed.data.checkoutId)}`;
        const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
        if (current && String(current.data?.progress?.paymentReference || current.data?.response?.paymentReference || "") === ref) {
          return { store, key, current, checkoutId: String(indexed.data.checkoutId), paymentReference: ref };
        }
      }
      const db = requireDatabase();
      const result = await db.prepare(
        "SELECT key, value_json, etag FROM kv_store WHERE namespace = ?1 ORDER BY updated_at DESC LIMIT 1000"
      ).bind("vestige-checkouts").all();
      const matches = [];
      for (const row of Array.isArray(result?.results) ? result.results : []) {
        let data;
        try {
          data = JSON.parse(row.value_json);
        } catch (_) {
          continue;
        }
        const rowRef = String(data?.progress?.paymentReference || data?.response?.paymentReference || "").toUpperCase();
        if (rowRef === ref) matches.push({ row, data });
      }
      if (matches.length > 1) {
        const e = new Error("Multiple checkout records use this payment reference. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      if (!matches.length) {
        const e = new Error("No checkout was found for this payment reference.");
        e.statusCode = 404;
        throw e;
      }
      const match = matches[0];
      const checkoutId = String(match.row.key || "").replace(/^checkout-/, "");
      await indexBankPaymentReference(ref, checkoutId);
      return {
        store: await getCheckoutStore(),
        key: String(match.row.key),
        current: { data: match.data, etag: String(match.row.etag) },
        checkoutId,
        paymentReference: ref
      };
    }
    __name(locateBankCheckoutByReference, "locateBankCheckoutByReference");
    async function acquirePaymentConfirmationLock(paymentReference) {
      const store = getD1Store("vestige-payment-confirmation-locks");
      const key = String(paymentReference);
      const ownerId = randomUUID();
      const payload = { ownerId, expiresAt: Date.now() + STOCK_LOCK_TTL_MS };
      let result = await store.setJSON(key, payload, { onlyIfNew: true });
      if (result?.modified) return { store, key, ownerId };
      const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
      if (current && Number(current.data?.expiresAt || 0) <= Date.now()) {
        result = await store.setJSON(key, payload, { onlyIfMatch: current.etag });
        if (result?.modified) return { store, key, ownerId };
      }
      const e = new Error("This payment reference is already being confirmed. Please wait a moment and retry.");
      e.statusCode = 503;
      e.retryAfter = "2";
      throw e;
    }
    __name(acquirePaymentConfirmationLock, "acquirePaymentConfirmationLock");
    async function releasePaymentConfirmationLock(lock) {
      if (!lock?.store || !lock?.key || !lock?.ownerId) return;
      try {
        const current = await lock.store.getWithMetadata(lock.key, { type: "json", consistency: "strong" });
        if (!current || String(current.data?.ownerId || "") !== String(lock.ownerId)) return;
        await lock.store.setJSON(lock.key, { ownerId: lock.ownerId, expiresAt: Date.now() - 1, released: true }, { onlyIfMatch: current.etag });
      } catch (error) {
        console.warn("Unable to release payment confirmation lock", { message: error.message });
      }
    }
    __name(releasePaymentConfirmationLock, "releasePaymentConfirmationLock");
    function storedBankOrderFromCheckout(checkoutId, data) {
      const progress = data?.progress || {};
      const customer = progress.customer || {};
      return validateBankCartOrder({
        checkoutId,
        customerName: customer.customerName,
        email: customer.email,
        mobile: customer.mobile,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        city: customer.city,
        province: customer.province,
        postalCode: customer.postalCode,
        country: customer.country,
        deliveryMethod: progress.deliveryMethod || DELIVERY_METHOD_COURIER,
        courierLocker: progress.courierLocker,
        items: progress.items,
        amount: progress.amount
      }, { trustedStored: true });
    }
    __name(storedBankOrderFromCheckout, "storedBankOrderFromCheckout");
    async function requireActiveCheckoutReservation(itemId, checkoutId, quantity) {
      const { reservations } = await readWebsiteReservations(itemId);
      const row = reservations.find((entry) => String(entry.checkoutId) === String(checkoutId));
      if (!row || Number(row.quantity || 0) < Number(quantity || 0)) {
        const e = new Error("The website stock reservation for this paid order is no longer active. Do not auto-confirm it; review stock and the bank payment manually.");
        e.statusCode = 409;
        throw e;
      }
      return row;
    }
    __name(requireActiveCheckoutReservation, "requireActiveCheckoutReservation");
    function bankInvoiceLineSignature(lines) {
      return (Array.isArray(lines) ? lines : []).map((line) => ({
        itemId: String(line.item_id || ""),
        quantity: Number(line.quantity || 0),
        rate: Number(line.rate || 0)
      })).sort((a, b) => a.itemId.localeCompare(b.itemId));
    }
    __name(bankInvoiceLineSignature, "bankInvoiceLineSignature");
    function assertBankInvoiceMatches(invoice, order, customer, paymentReference) {
      if (!invoice?.invoice_id) {
        const e = new Error("Recovered Zoho invoice is incomplete.");
        e.statusCode = 409;
        throw e;
      }
      if (isVoidedStatus(invoice.status)) {
        const e = new Error("Recovered Zoho invoice has been voided.");
        e.statusCode = 409;
        throw e;
      }
      if (String(invoice.reference_number || "") !== String(paymentReference)) {
        const e = new Error("Recovered invoice reference does not match this payment.");
        e.statusCode = 409;
        throw e;
      }
      if (String(invoice.customer_id || "") !== String(customer.contact_id || "")) {
        const e = new Error("Recovered invoice belongs to a different customer. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      const expected = order.items.map((line) => ({ itemId: String(line.itemId), quantity: Number(line.quantity), rate: Number(line.unitPrice) })).sort((a, b) => a.itemId.localeCompare(b.itemId));
      const actual = bankInvoiceLineSignature(invoice.line_items);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        const e = new Error("Recovered invoice basket does not match this checkout. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      if (Math.abs(Number(invoice.shipping_charge || 0) - Number(order.deliveryCharge || 0)) > PAYMENT_EPSILON) {
        const e = new Error("Recovered invoice fulfilment charge does not match this checkout. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      if (Math.abs(Number(invoice.total || 0) - Number(order.amount)) > PAYMENT_EPSILON) {
        const e = new Error("Recovered invoice total does not match the verified bank payment amount. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      return invoice;
    }
    __name(assertBankInvoiceMatches, "assertBankInvoiceMatches");
    async function findBankInvoice(order, customer, paymentReference, progress = {}) {
      if (progress.bankInvoiceId) {
        try {
          const invoice = await getInvoice(progress.bankInvoiceId);
          if (invoice?.invoice_id && !isVoidedStatus(invoice.status)) return assertBankInvoiceMatches(invoice, order, customer, paymentReference);
        } catch (error) {
          if (error.statusCode === 409) throw error;
        }
      }
      const data = await zohoRequest(`/invoices?${organizationQuery({ customer_id: String(customer.contact_id), reference_number: paymentReference, per_page: "100" })}`);
      const matches = (Array.isArray(data.invoices) ? data.invoices : []).filter((inv) => String(inv.reference_number || "") === paymentReference && !isVoidedStatus(inv.status));
      if (matches.length > 1) {
        const e = new Error("Multiple active Zoho invoices use this payment reference. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      if (!matches.length) return null;
      return assertBankInvoiceMatches(await getInvoice(matches[0].invoice_id), order, customer, paymentReference);
    }
    __name(findBankInvoice, "findBankInvoice");
    async function createBankInvoice(order, customer, paymentReference, paymentDate, stockLines) {
      const line_items = stockLines.map(({ line, item, snapshot }) => ({
        item_id: String(item.item_id),
        rate: Number(line.unitPrice),
        quantity: Number(line.quantity),
        ...String(snapshot?.locationId || "").trim() ? { location_id: String(snapshot.locationId).trim() } : {}
      }));
      const body = {
        customer_id: String(customer.contact_id),
        date: paymentDate,
        reference_number: paymentReference,
        shipping_charge: Number(order.deliveryCharge || 0),
        allow_partial_payments: false,
        line_items,
        notes: `Vestige bank-paid website order ${paymentReference}. Actual bank credit manually verified by Vestige Ltd. Fulfilment: ${deliveryLabelFor(order.deliveryMethod)}.${order.deliveryMethod === DELIVERY_METHOD_COURIER ? ` Courier Locker: ${order.courierLocker}.` : " Customer collection arranged directly."}`
      };
      const data = await zohoRequest(`/invoices?${organizationQuery()}`, { method: "POST", body });
      return data.invoice || {};
    }
    __name(createBankInvoice, "createBankInvoice");
    async function emailPaidBankInvoice(invoiceId, order, paymentReference) {
      const email = cleanText(order?.email, 160).toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("The customer email address is not valid for invoice delivery.");
      }
      const customerName = cleanText(order?.customerName, 120) || "Customer";
      const firstName = customerName.split(/\s+/).find(Boolean) || "Customer";
      const safeFirstName = firstName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      const subject = `Payment received \u2014 Vestige order ${paymentReference}`;
      const body = `Dear ${safeFirstName},<br><br>Thank you, ${safeFirstName}, from Vestige for your order and support. We have received and verified your payment for order <strong>${paymentReference}</strong>.<br><br>Your paid Zoho Books invoice is attached for your records.<br><br>Regards,<br>Vestige Ltd`;
      const data = await zohoRequest(
        `/invoices/${encodeURIComponent(invoiceId)}/email?${organizationQuery({ send_attachment: "true" })}`,
        {
          method: "POST",
          body: {
            to_mail_ids: [email],
            subject,
            body
          }
        }
      );
      return { sent: true, message: cleanText(data?.message, 240) || "Zoho invoice email scheduled." };
    }
    __name(emailPaidBankInvoice, "emailPaidBankInvoice");
    function assertBankPaymentMatches(payment, customer, invoice, paymentReference, amount) {
      if (!payment?.payment_id) {
        const e = new Error("Recovered Zoho customer payment is incomplete.");
        e.statusCode = 409;
        throw e;
      }
      if (String(payment.reference_number || "") !== paymentReference) {
        const e = new Error("Recovered customer payment reference does not match. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      if (String(payment.customer_id || "") !== String(customer.contact_id || "")) {
        const e = new Error("Recovered customer payment belongs to a different customer. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      if (String(payment.payment_mode || "").toLowerCase() !== "banktransfer") {
        const e = new Error("Recovered customer payment uses a different payment mode. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      if (Math.abs(Number(payment.amount || 0) - Number(amount)) > PAYMENT_EPSILON) {
        const e = new Error("Recovered customer payment amount does not match the confirmed bank credit. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      const applied = (Array.isArray(payment.invoices) ? payment.invoices : []).filter((row) => String(row.invoice_id || "") === String(invoice.invoice_id));
      const appliedTotal = applied.reduce((sum, row) => sum + Number(row.amount_applied || 0), 0);
      if (Math.abs(appliedTotal - Number(amount)) > PAYMENT_EPSILON) {
        const e = new Error("Recovered customer payment is not fully applied to the expected invoice. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      return payment;
    }
    __name(assertBankPaymentMatches, "assertBankPaymentMatches");
    async function getCustomerPayment(paymentId) {
      const data = await zohoRequest(`/customerpayments/${encodeURIComponent(paymentId)}?${organizationQuery()}`);
      return data.payment || {};
    }
    __name(getCustomerPayment, "getCustomerPayment");
    async function findBankCustomerPayment(customer, invoice, paymentReference, amount, progress = {}) {
      if (progress.bankPaymentId) {
        try {
          return assertBankPaymentMatches(await getCustomerPayment(progress.bankPaymentId), customer, invoice, paymentReference, amount);
        } catch (error) {
          if (error.statusCode === 409) throw error;
        }
      }
      const data = await zohoRequest(`/customerpayments?${organizationQuery({ customer_id: String(customer.contact_id), reference_number: paymentReference, per_page: "100" })}`);
      const matches = (Array.isArray(data.customerpayments) ? data.customerpayments : Array.isArray(data.payments) ? data.payments : []).filter((row) => String(row.reference_number || "") === paymentReference);
      if (matches.length > 1) {
        const e = new Error("Multiple Zoho customer payments use this payment reference. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      if (!matches.length) return null;
      return assertBankPaymentMatches(await getCustomerPayment(matches[0].payment_id), customer, invoice, paymentReference, amount);
    }
    __name(findBankCustomerPayment, "findBankCustomerPayment");
    async function createBankCustomerPayment(customer, invoice, paymentReference, amount, paymentDate) {
      const body = {
        customer_id: String(customer.contact_id),
        payment_mode: "banktransfer",
        amount: Number(amount),
        date: paymentDate,
        reference_number: paymentReference,
        description: `Vestige bank payment ${paymentReference}. Actual bank credit manually verified before recording payment.`,
        invoices: [{ invoice_id: String(invoice.invoice_id), amount_applied: Number(amount) }]
      };
      const accountId = cleanText(runtimeEnv("ZOHO_BANK_ACCOUNT_ID"), 40);
      if (accountId) {
        if (!/^\d+$/.test(accountId)) {
          const e = new Error("ZOHO_BANK_ACCOUNT_ID must be a numeric Zoho Books account ID.");
          e.statusCode = 503;
          throw e;
        }
        body.account_id = accountId;
      }
      const data = await zohoRequest(`/customerpayments?${organizationQuery()}`, { method: "POST", body });
      return data.payment || {};
    }
    __name(createBankCustomerPayment, "createBankCustomerPayment");
    async function beginBankConfirmationState(located) {
      const latest = await located.store.getWithMetadata(located.key, { type: "json", consistency: "strong" });
      if (!latest) {
        const e = new Error("Checkout could not be found before confirmation.");
        e.statusCode = 404;
        throw e;
      }
      const state = String(latest.data?.state || "");
      if (state === "confirmed" || state === "confirming_payment") return latest.data;
      if (state !== "pending_payment") {
        const e = new Error("Checkout is no longer pending payment. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      const record = {
        ...latest.data,
        state: "confirming_payment",
        progress: {
          ...latest.data?.progress || {},
          confirmationStartedAt: (/* @__PURE__ */ new Date()).toISOString(),
          ...Number(latest.data?.progress?.paymentExpiresAt || 0) <= Date.now() ? { paidAfterExpiryRecoveredAt: (/* @__PURE__ */ new Date()).toISOString() } : {}
        },
        updatedAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1e3
      };
      const result = await located.store.setJSON(located.key, record, { onlyIfMatch: latest.etag });
      if (!result?.modified) {
        const e = new Error("Checkout confirmation state changed concurrently. Please retry.");
        e.statusCode = 503;
        e.retryAfter = "2";
        throw e;
      }
      return record;
    }
    __name(beginBankConfirmationState, "beginBankConfirmationState");
    async function strictlyConfirmBankCheckout(located, invoice, payment, paymentDate, amount) {
      const latest = await located.store.getWithMetadata(located.key, { type: "json", consistency: "strong" });
      if (!latest) {
        const e = new Error("Checkout disappeared before confirmation could be recorded.");
        e.statusCode = 409;
        throw e;
      }
      if (String(latest.data?.state || "") === "confirmed") return latest.data;
      if (!["pending_payment", "confirming_payment"].includes(String(latest.data?.state || ""))) {
        const e = new Error("Checkout is no longer eligible for payment confirmation. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      const record = {
        ...latest.data,
        state: "confirmed",
        progress: {
          ...latest.data?.progress || {},
          bankInvoiceId: String(invoice.invoice_id),
          bankPaymentId: String(payment.payment_id),
          bankPaymentDate: paymentDate,
          bankConfirmedAmount: Number(amount)
        },
        verified: {
          paymentId: String(payment.payment_id),
          invoiceId: String(invoice.invoice_id),
          amount: Number(amount),
          paymentMode: "banktransfer",
          confirmationSource: "manual_bank_credit",
          confirmedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        updatedAt: Date.now(),
        expiresAt: Date.now() + PAYMENT_VERIFICATION_GRACE_MS
      };
      const result = await located.store.setJSON(located.key, record, { onlyIfMatch: latest.etag });
      if (!result?.modified) {
        const e = new Error("Checkout confirmation state changed concurrently. Retry the same payment reference; Zoho recovery prevents duplicate financial records.");
        e.statusCode = 503;
        e.retryAfter = "2";
        throw e;
      }
      return record;
    }
    __name(strictlyConfirmBankCheckout, "strictlyConfirmBankCheckout");
    var VESTIGE_FULFILMENT_STATES = /* @__PURE__ */ new Set(["confirmed", "preparing", "ready_for_collection", "dispatched", "completed"]);
    function normaliseFulfilmentRecord(data, deliveryMethod) {
      const raw = data?.fulfilment && typeof data.fulfilment === "object" ? data.fulfilment : {};
      const state = VESTIGE_FULFILMENT_STATES.has(String(raw.state || "")) ? String(raw.state) : "confirmed";
      return {
        state,
        deliveryMethod,
        trackingReference: cleanText(raw.trackingReference, 100) || null,
        updatedAt: Number(raw.updatedAt || 0) || null,
        preparingAt: Number(raw.preparingAt || 0) || null,
        readyForCollectionAt: Number(raw.readyForCollectionAt || 0) || null,
        dispatchedAt: Number(raw.dispatchedAt || 0) || null,
        completedAt: Number(raw.completedAt || 0) || null,
        history: Array.isArray(raw.history) ? raw.history.slice(-20) : []
      };
    }
    __name(normaliseFulfilmentRecord, "normaliseFulfilmentRecord");
    function fulfilmentLabel(state, deliveryMethod) {
      const value = String(state || "confirmed");
      if (value === "preparing") return "Preparing order";
      if (value === "ready_for_collection") return "Ready for collection";
      if (value === "dispatched") return "Dispatched";
      if (value === "completed") return deliveryMethod === DELIVERY_METHOD_COLLECTION ? "Collected / completed" : "Delivered / completed";
      return "Payment confirmed";
    }
    __name(fulfilmentLabel, "fulfilmentLabel");
    function validateFulfilmentTransition(currentState, nextState, deliveryMethod) {
      const current = VESTIGE_FULFILMENT_STATES.has(String(currentState || "")) ? String(currentState) : "confirmed";
      const next = cleanText(nextState, 40);
      if (!VESTIGE_FULFILMENT_STATES.has(next) || next === "confirmed") {
        const e = new TypeError("Select a valid fulfilment action.");
        e.statusCode = 400;
        throw e;
      }
      if (next === current) return { current, next, replayed: true };
      const allowed = deliveryMethod === DELIVERY_METHOD_COLLECTION ? {
        confirmed: "preparing",
        preparing: "ready_for_collection",
        ready_for_collection: "completed"
      } : {
        confirmed: "preparing",
        preparing: "dispatched",
        dispatched: "completed"
      };
      if (allowed[current] !== next) {
        const e = new Error(`Fulfilment cannot move from ${fulfilmentLabel(current, deliveryMethod)} to ${fulfilmentLabel(next, deliveryMethod)}.`);
        e.statusCode = 409;
        throw e;
      }
      return { current, next, replayed: false };
    }
    __name(validateFulfilmentTransition, "validateFulfilmentTransition");
    async function adminUpdateFulfilment(input, requestId) {
      const ref = validatePaymentReference(input?.paymentReference);
      const located = await locateBankCheckoutByReference(ref);
      const current = await located.store.getWithMetadata(located.key, { type: "json", consistency: "strong" });
      if (!current) {
        const e = new Error("Checkout could not be found.");
        e.statusCode = 404;
        throw e;
      }
      const data = current.data || {};
      if (String(data.state || "") !== "confirmed") {
        const e = new Error("Fulfilment can start only after payment has been confirmed.");
        e.statusCode = 409;
        throw e;
      }
      const progress = data.progress || {};
      const response = data.response || {};
      const deliveryMethod = validateDeliveryMethod(progress.deliveryMethod || response?.order?.deliveryMethod || DELIVERY_METHOD_COURIER);
      const existing = normaliseFulfilmentRecord(data, deliveryMethod);
      const transition = validateFulfilmentTransition(existing.state, input?.fulfilmentState, deliveryMethod);
      const trackingReference = cleanText(input?.trackingReference, 100);
      if (transition.next === "dispatched" && !trackingReference && !existing.trackingReference) {
        const e = new TypeError("Enter the courier tracking reference before marking the order dispatched.");
        e.statusCode = 400;
        throw e;
      }
      if (deliveryMethod === DELIVERY_METHOD_COLLECTION && trackingReference) {
        const e = new TypeError("Courier tracking is not applicable to collection orders.");
        e.statusCode = 400;
        throw e;
      }
      if (transition.replayed) {
        return { success: true, replayed: true, order: await adminLookupBankOrder(ref), message: `Fulfilment is already ${fulfilmentLabel(existing.state, deliveryMethod).toLowerCase()}.` };
      }
      const now = Date.now();
      const next = {
        ...existing,
        state: transition.next,
        deliveryMethod,
        trackingReference: trackingReference || existing.trackingReference || null,
        updatedAt: now,
        history: [...existing.history, { state: transition.next, at: now, trackingReference: transition.next === "dispatched" ? trackingReference || existing.trackingReference || null : null }].slice(-20)
      };
      if (transition.next === "preparing") next.preparingAt = now;
      if (transition.next === "ready_for_collection") next.readyForCollectionAt = now;
      if (transition.next === "dispatched") next.dispatchedAt = now;
      if (transition.next === "completed") next.completedAt = now;
      const record = { ...data, fulfilment: next, updatedAt: now };
      const written = await located.store.setJSON(located.key, record, { onlyIfMatch: current.etag });
      if (!written?.modified) {
        const e = new Error("The order changed while fulfilment was being updated. Reload the order and retry.");
        e.statusCode = 409;
        throw e;
      }
      await writeAuditEvent({
        action: "admin_update_fulfilment",
        actor: "owner",
        paymentReference: ref,
        outcome: "success",
        requestId,
        message: `${fulfilmentLabel(transition.next, deliveryMethod)}${next.trackingReference && transition.next === "dispatched" ? ` · Tracking ${next.trackingReference}` : ""}.`
      });
      let customerNotification = { sent: false, configured: false };
      try {
        customerNotification = await notifyCustomerFulfilmentOnce(record, ref, next, deliveryMethod);
        await writeAuditEvent({
          action: "customer_fulfilment_email",
          actor: "system",
          paymentReference: ref,
          outcome: customerNotification.sent ? customerNotification.replayed ? "replayed" : "success" : "failed",
          requestId,
          message: customerNotification.sent ? `Customer ${fulfilmentLabel(transition.next, deliveryMethod).toLowerCase()} notification ${customerNotification.replayed ? "already sent" : "sent"}.` : cleanText(customerNotification.message || customerNotification.error, 240) || "Customer fulfilment notification was not sent."
        });
      } catch (notificationError) {
        await writeAuditEvent({
          action: "customer_fulfilment_email",
          actor: "system",
          paymentReference: ref,
          outcome: "failed",
          requestId,
          message: cleanText(notificationError?.message, 240) || "Customer fulfilment notification failed."
        });
        customerNotification = { sent: false, configured: true, error: cleanText(notificationError?.message, 240) || "Customer fulfilment notification failed." };
      }
      const notificationNote = customerNotification.sent ? customerNotification.replayed ? " Customer notification was already sent." : " Customer notified." : " Fulfilment saved; customer notification needs review.";
      return { success: true, replayed: false, order: await adminLookupBankOrder(ref), customerNotification, message: `${fulfilmentLabel(transition.next, deliveryMethod)} recorded.${notificationNote}` };
    }
    __name(adminUpdateFulfilment, "adminUpdateFulfilment");
    function publicAdminOrderSummary(located, current) {
      const data = current?.data || {};
      const progress = data.progress || {};
      const verified = data.verified || {};
      const response = data.response || {};
      const customer = progress.customer || {};
      const items = Array.isArray(progress.items) ? progress.items.map((line) => {
        const productKey = checkoutProductKeyFromInput(line);
        const spec = checkoutProductDefinition(productKey);
        const quantity = Number(line.quantity || 0);
        const unitPrice = Number(spec?.unitPrice ?? line.unitPrice ?? PRODUCT_PRICE_ZAR);
        return {
          productKey: productKey || null,
          productFamily: spec?.family || cleanText(line.productFamily, 80) || "BC10000",
          variant: spec?.variant || cleanText(line.variant ?? line.flavour, 80),
          flavour: spec?.variant || cleanText(line.flavour, 80),
          displayName: spec?.displayName || cleanText(line.displayName, 160) || cleanText(line.flavour, 80),
          itemId: cleanText(line.itemId, 80),
          quantity,
          unitPrice,
          lineTotal: quantity * unitPrice
        };
      }) : [];
      const paymentReference = cleanText(
        progress.paymentReference || response.paymentReference || located?.paymentReference,
        24
      );
      return {
        paymentReference,
        checkoutId: String(located?.checkoutId || ""),
        state: cleanText(data.state, 40) || "unknown",
        paymentMode: cleanText(progress.paymentMode || response.paymentMode, 40) || null,
        amount: Number(progress.amount || response?.order?.amount || 0),
        totalQuantity: Number(progress.totalQuantity || response?.order?.totalQuantity || 0),
        deliveryMethod: validateDeliveryMethod(progress.deliveryMethod || response?.order?.deliveryMethod || DELIVERY_METHOD_COURIER),
        deliveryCharge: Number(progress.deliveryCharge ?? response?.order?.deliveryCharge ?? DELIVERY_PRICE_ZAR),
        courierLocker: cleanText(progress.courierLocker, 120) || null,
        paymentExpiresAt: Number(progress.paymentExpiresAt || 0) || null,
        paymentClaimedAt: Number(progress.paymentClaimedAt || 0) || null,
        paymentReviewHoldAt: Number(progress.paymentReviewHoldAt || 0) || null,
        paymentReviewHoldStatus: cleanText(progress.paymentReviewHoldStatus, 60) || null,
        fulfilment: normaliseFulfilmentRecord(data, validateDeliveryMethod(progress.deliveryMethod || response?.order?.deliveryMethod || DELIVERY_METHOD_COURIER)),
        createdAt: Number(data.createdAt || data.created_at || 0) || null,
        updatedAt: Number(data.updatedAt || 0) || null,
        invoiceId: cleanText(progress.bankInvoiceId || progress.invoiceId || verified.invoiceId, 80) || null,
        paymentId: cleanText(progress.bankPaymentId || progress.paymentId || verified.paymentId, 80) || null,
        paymentDate: cleanText(progress.bankPaymentDate || verified.paymentDate, 20) || null,
        customer: {
          name: cleanText(customer.customerName, 120) || null,
          email: cleanText(customer.email, 160) || null,
          mobile: cleanText(customer.mobile, 60) || null,
          city: cleanText(customer.city, 100) || null,
          province: cleanText(customer.province, 100) || null
        },
        items
      };
    }
    __name(publicAdminOrderSummary, "publicAdminOrderSummary");
    async function adminLookupBankOrder(paymentReference) {
      const ref = validatePaymentReference(paymentReference);
      const located = await locateBankCheckoutByReference(ref);
      const current = await located.store.getWithMetadata(
        located.key,
        { type: "json", consistency: "strong" }
      );
      if (!current) {
        const e = new Error("Checkout could not be found.");
        e.statusCode = 404;
        throw e;
      }
      const summary = publicAdminOrderSummary(located, current);
      const reservations = [];
      for (const line of summary.items) {
        const state = await readWebsiteReservations(line.itemId);
        const row = state.reservations.find(
          (entry) => String(entry.checkoutId) === String(located.checkoutId)
        );
        reservations.push({
          flavour: line.flavour,
          itemId: line.itemId,
          orderedQuantity: line.quantity,
          reservationActive: Boolean(row && Number(row.quantity || 0) >= Number(line.quantity || 0)),
          reservedQuantity: row ? Number(row.quantity || 0) : 0,
          reservationExpiresAt: row ? Number(row.expiresAt || 0) || null : null
        });
      }
      return {
        ...summary,
        reservations,
        cancellable: ["pending_payment", "cancelling_customer"].includes(summary.state),
        confirmable: ["pending_payment", "confirming_payment"].includes(summary.state)
      };
    }
    __name(adminLookupBankOrder, "adminLookupBankOrder");
    async function adminRecentBankOrders(limit = 25) {
      const safeLimit = Math.min(Math.max(Number(limit || 25), 1), 50);
      const db = requireDatabase();
      const result = await db.prepare(
        "SELECT key, value_json, updated_at FROM kv_store WHERE namespace = ?1 ORDER BY updated_at DESC LIMIT ?2"
      ).bind("vestige-checkouts", safeLimit * 4).all();
      const orders = [];
      for (const row of Array.isArray(result?.results) ? result.results : []) {
        let data;
        try {
          data = JSON.parse(row.value_json);
        } catch (_) {
          continue;
        }
        const progress = data?.progress || {};
        const response = data?.response || {};
        const ref = cleanText(progress.paymentReference || response.paymentReference, 24).toUpperCase();
        if (!/^V\d{4,8}$/.test(ref)) continue;
        const checkoutId = String(row.key || "").replace(/^checkout-/, "");
        orders.push(publicAdminOrderSummary(
          { checkoutId, paymentReference: ref },
          { data }
        ));
        if (orders.length >= safeLimit) break;
      }
      return orders;
    }
    __name(adminRecentBankOrders, "adminRecentBankOrders");
    async function adminCancelUnpaidBankOrder(paymentReference) {
      const ref = validatePaymentReference(paymentReference);
      const lock = await acquirePaymentConfirmationLock(ref);
      try {
        const located = await locateBankCheckoutByReference(ref);
        let current = await located.store.getWithMetadata(
          located.key,
          { type: "json", consistency: "strong" }
        );
        if (!current) {
          const e = new Error("Checkout could not be found.");
          e.statusCode = 404;
          throw e;
        }
        const state = String(current.data?.state || "");
        if (state === "confirmed" || state === "confirming_payment") {
          const e = new Error(
            "This order cannot be voided as unpaid because payment confirmation has already started or completed."
          );
          e.statusCode = 409;
          throw e;
        }
        if (["cancelled_unpaid", "cancelled_customer", "expired"].includes(state)) {
          return {
            success: true,
            replayed: true,
            paymentReference: ref,
            state,
            reservationsReleased: 0,
            message: "This unpaid checkout is already closed and does not require another cancellation."
          };
        }
        if (!["pending_payment", "cancelling_customer"].includes(state)) {
          const e = new Error("This checkout state is not eligible for unpaid cancellation.");
          e.statusCode = 409;
          throw e;
        }
        const order = storedBankOrderFromCheckout(located.checkoutId, current.data);
        const cancelling = {
          ...current.data,
          state: "cancelling_unpaid_admin",
          progress: {
            ...current.data?.progress || {},
            adminCancellationStartedAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          updatedAt: Date.now()
        };
        const started = await located.store.setJSON(
          located.key,
          cancelling,
          { onlyIfMatch: current.etag }
        );
        if (!started?.modified) {
          const e = new Error("The order changed while cancellation was starting. Refresh and try again.");
          e.statusCode = 503;
          e.retryAfter = "2";
          throw e;
        }
        let released = 0;
        for (const line of order.items) {
          await releaseWebsiteReservationStrict(line.itemId, located.checkoutId);
          released += 1;
        }
        current = await located.store.getWithMetadata(
          located.key,
          { type: "json", consistency: "strong" }
        );
        if (!current) {
          const e = new Error("Checkout disappeared before cancellation could be finalized.");
          e.statusCode = 409;
          throw e;
        }
        const cancelled = {
          ...current.data,
          state: "cancelled_unpaid",
          progress: {
            ...current.data?.progress || {},
            adminCancelledAt: (/* @__PURE__ */ new Date()).toISOString(),
            cancellationReason: "Owner voided unpaid bank checkout.",
            paymentExpiresAt: Date.now()
          },
          verified: {
            ...current.data?.verified || {},
            paymentStatus: "cancelled",
            bankCreditConfirmed: false
          },
          updatedAt: Date.now(),
          expiresAt: Date.now() + PAYMENT_VERIFICATION_GRACE_MS
        };
        const finished = await located.store.setJSON(
          located.key,
          cancelled,
          { onlyIfMatch: current.etag }
        );
        if (!finished?.modified) {
          const e = new Error(
            "Stock was released but the final cancellation state changed concurrently. Refresh the order before taking any further action."
          );
          e.statusCode = 503;
          e.retryAfter = "2";
          throw e;
        }
        cachedAvailabilityUntil = 0;
        return {
          success: true,
          replayed: false,
          paymentReference: ref,
          state: "cancelled_unpaid",
          reservationsReleased: released,
          totalQuantityReleased: order.items.reduce(
            (sum, line) => sum + Number(line.quantity || 0),
            0
          ),
          message: "Unpaid order cancelled and all website stock reservations were released."
        };
      } finally {
        await releasePaymentConfirmationLock(lock);
      }
    }
    __name(adminCancelUnpaidBankOrder, "adminCancelUnpaidBankOrder");
    async function adminStockDashboard() {
      const availability = await getOwnerInventoryAvailability(true, false);
      const result = {};
      for (const [flavour, item] of Object.entries(availability)) {
        const itemId = cleanText(item.itemId || item.item_id, 80) || null;
        let websiteReserved = 0;
        let ownerExcluded = 0;
        let sellableStock = Math.max(0, Number(item.stock || 0));
        if (itemId) {
          try {
            const adjusted = await applyWebsiteReservationOverlay({
              ...item,
              requestedQuantity: 1,
              canFulfil: Boolean(item.available) && Number(item.stock || 0) >= 1
            }, itemId);
            websiteReserved = Math.max(0, Number(adjusted.websiteReserved || 0));
            ownerExcluded = Math.max(0, Number(adjusted.ownerExcluded || 0));
            sellableStock = Math.max(0, Math.floor(Number(adjusted.stock || 0)));
          } catch (_) {
            sellableStock = 0;
          }
        }
        const zohoStock = Math.max(0, Number(item.stock || 0));
        let alertLevel = "healthy";
        if (sellableStock <= 0) alertLevel = "out";
        else if (sellableStock <= 2) alertLevel = "critical";
        else if (sellableStock <= 5) alertLevel = "low";
        result[flavour] = {
          available: Boolean(item.available) && sellableStock > 0,
          stock: sellableStock,
          zohoStock,
          websiteReserved,
          ownerExcluded,
          sellableStock,
          alertLevel,
          itemId,
          reason: cleanText(item.reason, 180) || null,
          productFamily: cleanText(item.productFamily, 80) || "BC10000",
          variant: cleanText(item.variant, 100) || flavour,
          sku: cleanText(item.sku, 80) || null,
          itemName: cleanText(item.itemName, 180) || null,
          price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
          expectedRetailPrice: Number.isFinite(Number(item.expectedRetailPrice)) ? Number(item.expectedRetailPrice) : null,
          checkoutEnabled: item.checkoutEnabled === true
        };
      }
      return result;
    }
    __name(adminStockDashboard, "adminStockDashboard");
    function validateOwnerStockAdjustmentInput(input) {
      const flavour = cleanText(input?.flavour, 80);
      if (!ALLOWED_FLAVOURS.has(flavour)) {
        const e = new TypeError("Select a valid BC10000 flavour.");
        e.statusCode = 400;
        throw e;
      }
      const operation = cleanText(input?.operation, 20).toLowerCase();
      if (!["remove", "return"].includes(operation)) {
        const e = new TypeError("Select whether stock is being removed from or returned to sale.");
        e.statusCode = 400;
        throw e;
      }
      const quantity = Number(input?.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        const e = new TypeError("Stock adjustment quantity must be a whole number from 1 to 100.");
        e.statusCode = 400;
        throw e;
      }
      const reason = cleanText(input?.reason, 30).toLowerCase();
      if (!OWNER_STOCK_ADJUSTMENT_REASONS.has(reason)) {
        const e = new TypeError("Select a valid stock-adjustment reason.");
        e.statusCode = 400;
        throw e;
      }
      const note = cleanText(input?.note, 180) || null;
      return { flavour, operation, quantity, reason, note };
    }
    __name(validateOwnerStockAdjustmentInput, "validateOwnerStockAdjustmentInput");
    function ownerStockAdjustmentFingerprint(plan) {
      return createHash("sha256").update(JSON.stringify({
        flavour: plan.flavour,
        itemId: plan.itemId,
        operation: plan.operation,
        quantity: plan.quantity,
        reason: plan.reason,
        zohoStock: plan.zohoStock,
        websiteReserved: plan.websiteReserved,
        ownerExcludedBefore: plan.ownerExcludedBefore,
        sellableBefore: plan.sellableBefore,
        sellableAfter: plan.sellableAfter,
        ledgerEtag: plan.ledgerEtag || null
      })).digest("hex");
    }
    __name(ownerStockAdjustmentFingerprint, "ownerStockAdjustmentFingerprint");
    async function buildOwnerStockAdjustmentPlan(input, forceFresh = true) {
      const clean = validateOwnerStockAdjustmentInput(input);
      const item = await resolveSelectedProductItem(clean.flavour, "", forceFresh);
      const snapshot = buildStockSnapshot(clean.flavour, item, 1);
      if (!snapshot.itemId || !Number.isFinite(Number(snapshot.stock))) {
        const e = new Error("Live Zoho stock could not be verified for this flavour.");
        e.statusCode = 409;
        throw e;
      }
      const [{ reservations }, ledger] = await Promise.all([
        readWebsiteReservations(snapshot.itemId),
        readOwnerStockAdjustmentState(snapshot.itemId)
      ]);
      const locationId = String(snapshot.locationId || "");
      const websiteReserved = reservations.filter((row) => String(row.locationId || "") === locationId).reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0);
      const ownerExcludedBefore = Math.max(0, Number(ledger.state.excluded || 0));
      const zohoStock = Math.max(0, Math.floor(Number(snapshot.stock || 0)));
      const physical = Number.isFinite(Number(snapshot.physicalStock)) ? Math.max(0, Math.floor(Number(snapshot.physicalStock))) : null;
      const baseBound = physical === null ? zohoStock : Math.min(zohoStock, physical);
      const sellableBefore = Math.max(0, baseBound - websiteReserved - ownerExcludedBefore);
      let ownerExcludedAfter = ownerExcludedBefore;
      if (clean.operation === "remove") {
        if (clean.quantity > sellableBefore) {
          const e = new Error(`Only ${sellableBefore} unit(s) are currently sellable. Reduce the adjustment quantity.`);
          e.statusCode = 409;
          throw e;
        }
        ownerExcludedAfter += clean.quantity;
      } else {
        if (clean.quantity > ownerExcludedBefore) {
          const e = new Error(`Only ${ownerExcludedBefore} unit(s) are currently excluded by owner stock adjustments.`);
          e.statusCode = 409;
          throw e;
        }
        ownerExcludedAfter -= clean.quantity;
      }
      const sellableAfter = Math.max(0, baseBound - websiteReserved - ownerExcludedAfter);
      const plan = {
        ...clean,
        itemId: String(snapshot.itemId),
        itemName: snapshot.itemName || PRODUCT_NAMES[clean.flavour],
        locationId: snapshot.locationId || null,
        zohoStock,
        websiteReserved,
        ownerExcludedBefore,
        ownerExcludedAfter,
        sellableBefore,
        sellableAfter,
        ledgerEtag: ledger.current?.etag || null
      };
      plan.previewFingerprint = ownerStockAdjustmentFingerprint(plan);
      plan.confirmationRequired = `${clean.operation === "remove" ? "REMOVE" : "RETURN"} ${clean.quantity} ${clean.flavour}`.toUpperCase();
      return plan;
    }
    __name(buildOwnerStockAdjustmentPlan, "buildOwnerStockAdjustmentPlan");
    async function adminPreviewStockAdjustment(input) {
      const plan = await buildOwnerStockAdjustmentPlan(input, true);
      return { ...plan, zohoBooksChanged: false, ledger: "vestige-owner-stock-adjustments" };
    }
    __name(adminPreviewStockAdjustment, "adminPreviewStockAdjustment");
    async function adminApplyStockAdjustment(input, requestId) {
      const suppliedFingerprint = cleanText(input?.previewFingerprint, 80).toLowerCase();
      const confirmation = cleanText(input?.confirmation, 100).toUpperCase();
      const initial = await buildOwnerStockAdjustmentPlan(input, true);
      if (!/^[a-f0-9]{64}$/.test(suppliedFingerprint) || !safeEqual(suppliedFingerprint, initial.previewFingerprint)) {
        const e = new Error("Stock-adjustment preview is stale. Preview the adjustment again.");
        e.statusCode = 409;
        throw e;
      }
      if (!safeEqual(confirmation, initial.confirmationRequired)) {
        const e = new Error(`Type the exact confirmation phrase: ${initial.confirmationRequired}`);
        e.statusCode = 409;
        throw e;
      }
      const lock = await acquireStockLock(initial.itemId, `owner-stock-${randomUUID()}`);
      try {
        const plan = await buildOwnerStockAdjustmentPlan(input, true);
        if (!safeEqual(suppliedFingerprint, plan.previewFingerprint)) {
          const e = new Error("Stock changed after the preview. Preview the adjustment again.");
          e.statusCode = 409;
          throw e;
        }
        const delta = plan.operation === "remove" ? plan.quantity : -plan.quantity;
        const at = Date.now();
        const entry = { id: randomUUID(), at, flavour: plan.flavour, itemId: plan.itemId, delta, operation: plan.operation, quantity: plan.quantity, reason: plan.reason, note: plan.note };
        const updated = await mutateOwnerStockAdjustmentState(plan.itemId, (state) => ({ excluded: plan.ownerExcludedAfter, entries: [...state.entries || [], entry] }));
        cachedAvailabilityUntil = 0;
        await writeAuditEvent({ action: "admin_stock_adjustment", actor: "owner", outcome: "success", message: `${plan.operation === "remove" ? "Removed" : "Returned"} ${plan.quantity} ${plan.flavour}; reason ${plan.reason}; sellable ${plan.sellableBefore} -> ${plan.sellableAfter}.`, requestId });
        return {
          success: true,
          flavour: plan.flavour,
          itemId: plan.itemId,
          operation: plan.operation,
          quantity: plan.quantity,
          reason: plan.reason,
          note: plan.note,
          zohoStock: plan.zohoStock,
          websiteReserved: plan.websiteReserved,
          ownerExcluded: updated.excluded,
          sellableBefore: plan.sellableBefore,
          sellableAfter: plan.sellableAfter,
          zohoBooksChanged: false,
          message: `${plan.quantity} ${plan.flavour} unit(s) ${plan.operation === "remove" ? "removed from" : "returned to"} website sellable stock. Sellable now: ${plan.sellableAfter}.`
        };
      } finally {
        await releaseStockLock(lock);
      }
    }
    __name(adminApplyStockAdjustment, "adminApplyStockAdjustment");
    async function confirmBankPaymentManually(input) {
      const paymentReference = validatePaymentReference(input.paymentReference);
      const actualAmount = Number(input.actualAmount ?? input.amount);
      if (!Number.isFinite(actualAmount) || actualAmount <= 0) {
        const e = new TypeError("A valid confirmed bank-credit amount is required.");
        e.statusCode = 400;
        throw e;
      }
      const paymentDate = validatePaymentDate(input.paymentDate);
      if (input.bankCreditConfirmed !== true) {
        const e = new TypeError("Explicit bank-credit confirmation is required.");
        e.statusCode = 400;
        throw e;
      }
      const lock = await acquirePaymentConfirmationLock(paymentReference);
      const itemLocks = [];
      let customerLock = null;
      try {
        const located = await locateBankCheckoutByReference(paymentReference);
        let data = located.current.data || {};
        if (String(data.state || "") === "confirmed") {
          const verified = data.verified || {};
          return { success: true, replayed: true, paymentReference, state: "confirmed", invoiceId: verified.invoiceId || data.progress?.bankInvoiceId || null, paymentId: verified.paymentId || data.progress?.bankPaymentId || null, amount: Number(verified.amount || data.progress?.amount || 0) };
        }
        if (!["pending_payment", "confirming_payment"].includes(String(data.state || ""))) {
          const e = new Error("This checkout is not eligible for bank-payment confirmation. Manual review is required.");
          e.statusCode = 409;
          throw e;
        }
        if (String(data.progress?.paymentMode || data.response?.paymentMode || "") !== "bank_transfer") {
          const e = new Error("This checkout is not a bank-transfer checkout.");
          e.statusCode = 409;
          throw e;
        }
        const paidAfterExpiry = String(data.state || "") === "pending_payment" && Number(data.progress?.paymentExpiresAt || 0) <= Date.now();
        const order = storedBankOrderFromCheckout(located.checkoutId, data);
        if (Math.abs(actualAmount - Number(order.amount)) > PAYMENT_EPSILON) {
          const e = new Error(`Confirmed bank credit must equal the exact order total of ${moneyForError(order.amount)}.`);
          e.statusCode = 409;
          throw e;
        }
        const lockLines = [...order.items].sort((a, b) => String(a.itemId).localeCompare(String(b.itemId)));
        for (const line of lockLines) itemLocks.push(await acquireStockLock(line.itemId, `bank-confirm-${located.checkoutId}`));
        const stockLines = [];
        for (const line of order.items) {
          const stock = await requireCheckoutStockState(line);
          const snapshot = await applyWebsiteReservationOverlay(stock.snapshot, line.itemId, located.checkoutId);
          if (!snapshot.canFulfil) {
            const e = new Error(
              paidAfterExpiry ? `${line.flavour} is no longer safely available for this already-paid expired order. Do not cancel or create another order; manual fulfilment review is required.` : `${line.flavour} can no longer be fulfilled safely. Do not auto-confirm this bank payment.`
            );
            e.statusCode = 409;
            throw e;
          }
          if (paidAfterExpiry) {
            await addWebsiteReservation(
              {
                checkoutId: located.checkoutId,
                itemId: line.itemId,
                quantity: line.quantity
              },
              snapshot,
              null
            );
          } else {
            await requireActiveCheckoutReservation(line.itemId, located.checkoutId, line.quantity);
          }
          stockLines.push({ line, item: stock.item, snapshot });
        }
        await beginBankConfirmationState(located);
        customerLock = await acquireCustomerLock(order.email, `bank-confirm-${located.checkoutId}`);
        const customer = await syncCustomer(order);
        const beforeFinancial = await located.store.getWithMetadata(located.key, { type: "json", consistency: "strong" });
        const progress = beforeFinancial?.data?.progress || data.progress || {};
        let invoice = await findBankInvoice(order, customer, paymentReference, progress);
        if (!invoice) invoice = await createBankInvoice(order, customer, paymentReference, paymentDate, stockLines);
        invoice = assertBankInvoiceMatches(await getInvoice(invoice.invoice_id), order, customer, paymentReference);
        if (!["sent", "overdue", "paid"].includes(String(invoice.status || "").toLowerCase())) invoice = await markInvoiceSent(invoice.invoice_id);
        let payment = await findBankCustomerPayment(customer, invoice, paymentReference, order.amount, progress);
        if (!payment) payment = await createBankCustomerPayment(customer, invoice, paymentReference, order.amount, paymentDate);
        payment = assertBankPaymentMatches(await getCustomerPayment(payment.payment_id), customer, invoice, paymentReference, order.amount);
        const finalInvoice = assertBankInvoiceMatches(await getInvoice(invoice.invoice_id), order, customer, paymentReference);
        if (Math.abs(Number(finalInvoice.balance || finalInvoice.balance_amount || 0)) > PAYMENT_EPSILON && String(finalInvoice.status || "").toLowerCase() !== "paid") {
          const e = new Error("Zoho payment was created but the invoice is not fully settled. Manual review is required.");
          e.statusCode = 409;
          throw e;
        }
        await strictlyConfirmBankCheckout(located, finalInvoice, payment, paymentDate, order.amount);
        for (const line of order.items) await bridgeConfirmedWebsiteReservation(line.itemId, located.checkoutId);
        cachedAvailabilityUntil = 0;
        let invoiceEmailSent = false;
        try {
          const mailed = await emailPaidBankInvoice(finalInvoice.invoice_id, order, paymentReference);
          invoiceEmailSent = Boolean(mailed?.sent);
          await writeAuditEvent({
            action: "customer_paid_invoice_email",
            actor: "system",
            paymentReference,
            outcome: invoiceEmailSent ? "success" : "failed",
            message: invoiceEmailSent ? "Paid Zoho invoice emailed to customer." : "Zoho invoice email was not confirmed.",
            invoiceId: String(finalInvoice.invoice_id),
            paymentId: String(payment.payment_id),
            amount: Number(order.amount)
          });
        } catch (mailError) {
          await writeAuditEvent({
            action: "customer_paid_invoice_email",
            actor: "system",
            paymentReference,
            outcome: "failed",
            message: cleanText(mailError?.message, 240) || "Paid invoice email failed.",
            invoiceId: String(finalInvoice.invoice_id),
            paymentId: String(payment.payment_id),
            amount: Number(order.amount)
          });
        }
        const completedAlert = await notifyOwnerOnce(
          "order-confirmed",
          paymentReference,
          `CONFIRMED \u2014 ${paymentReference} ${moneyForError(order.amount)}`,
          `Vestige order ${paymentReference} has been confirmed.\\n\\nAmount: ${moneyForError(order.amount)}\\nCustomer: ${order.customerName}\\nZoho invoice ID: ${finalInvoice.invoice_id}\\nZoho payment ID: ${payment.payment_id}\\nCustomer invoice email: ${invoiceEmailSent ? "sent/scheduled" : "needs review"}\\n\\nOwner Console:\\n${ownerConsoleUrl()}`
        );
        await writeAuditEvent({
          action: "owner_order_confirmed_notification",
          actor: "system",
          paymentReference,
          outcome: completedAlert.sent ? "success" : "not_sent",
          message: completedAlert.sent ? "Owner confirmation email delivered." : "Owner confirmation email not delivered.",
          invoiceId: String(finalInvoice.invoice_id),
          paymentId: String(payment.payment_id),
          amount: Number(order.amount)
        });
        return {
          success: true,
          replayed: false,
          paymentReference,
          state: "confirmed",
          invoiceId: String(finalInvoice.invoice_id),
          paymentId: String(payment.payment_id),
          amount: Number(order.amount),
          paymentDate,
          invoiceEmailSent,
          ownerAlertSent: Boolean(completedAlert.sent)
        };
      } finally {
        await releaseStockLock(customerLock);
        for (const itemLock of itemLocks.reverse()) await releaseStockLock(itemLock);
        await releasePaymentConfirmationLock(lock);
      }
    }
    __name(confirmBankPaymentManually, "confirmBankPaymentManually");
    function moneyForError(value) {
      return `R${Number(value || 0).toFixed(2)}`;
    }
    __name(moneyForError, "moneyForError");
    async function cancelBankCheckoutByCustomer(token) {
      const checkout = verifyCheckout(token);
      if (checkout.paymentMode !== "bank_transfer") {
        const e = new Error("This checkout token is not a bank-payment checkout.");
        e.statusCode = 400;
        throw e;
      }
      const paymentReference = validatePaymentReference(checkout.paymentReference);
      const lock = await acquirePaymentConfirmationLock(paymentReference);
      try {
        const located = await locateBankCheckoutByReference(paymentReference);
        let latest = await located.store.getWithMetadata(located.key, { type: "json", consistency: "strong" });
        if (!latest) {
          const e = new Error("Checkout could not be found.");
          e.statusCode = 404;
          throw e;
        }
        const currentState = String(latest.data?.state || "");
        if (Number(latest.data?.progress?.paymentClaimedAt || 0) > 0) {
          const e = new Error("Payment has already been reported for this order. The reserved stock is now under Vestige payment review and can only be released by the owner after bank verification.");
          e.statusCode = 409;
          throw e;
        }
        if (currentState === "confirmed" || currentState === "confirming_payment") {
          const e = new Error("This order can no longer be cancelled automatically because payment confirmation has started. Please contact Vestige Ltd.");
          e.statusCode = 409;
          throw e;
        }
        if (currentState === "expired" || currentState === "cancelled_unpaid") {
          return {
            success: true,
            replayed: true,
            state: currentState,
            paymentReference,
            reservationsReleased: 0,
            message: "This checkout is already closed and no longer holds stock."
          };
        }
        const order = storedBankOrderFromCheckout(located.checkoutId, latest.data);
        if (!["pending_payment", "cancelling_customer", "cancelled_customer"].includes(currentState)) {
          const e = new Error("This order is no longer eligible for automatic cancellation. Please contact Vestige Ltd.");
          e.statusCode = 409;
          throw e;
        }
        if (currentState !== "cancelled_customer" && currentState !== "cancelling_customer") {
          const cancelling = {
            ...latest.data,
            state: "cancelling_customer",
            progress: {
              ...latest.data?.progress || {},
              customerCancellationStartedAt: (/* @__PURE__ */ new Date()).toISOString()
            },
            updatedAt: Date.now()
          };
          const moved = await located.store.setJSON(located.key, cancelling, { onlyIfMatch: latest.etag });
          if (!moved?.modified) {
            const e = new Error("The checkout changed while cancellation was starting. Please try again.");
            e.statusCode = 503;
            e.retryAfter = "2";
            throw e;
          }
          latest = await located.store.getWithMetadata(located.key, { type: "json", consistency: "strong" });
        }
        let releasedCount = 0;
        for (const line of order.items) {
          await releaseWebsiteReservationStrict(line.itemId, located.checkoutId);
          releasedCount += 1;
        }
        const fresh = await located.store.getWithMetadata(located.key, { type: "json", consistency: "strong" });
        if (!fresh) {
          const e = new Error("Checkout disappeared before cancellation could be finalized.");
          e.statusCode = 409;
          throw e;
        }
        if (String(fresh.data?.state || "") !== "cancelled_customer") {
          const cancelled = {
            ...fresh.data,
            state: "cancelled_customer",
            progress: {
              ...fresh.data?.progress || {},
              customerCancelledAt: (/* @__PURE__ */ new Date()).toISOString(),
              cancellationReason: "Customer cancelled before bank payment was confirmed.",
              paymentExpiresAt: Date.now()
            },
            verified: {
              ...fresh.data?.verified || {},
              paymentStatus: "cancelled",
              bankCreditConfirmed: false
            },
            updatedAt: Date.now(),
            expiresAt: Date.now() + PAYMENT_VERIFICATION_GRACE_MS
          };
          const finalized = await located.store.setJSON(located.key, cancelled, { onlyIfMatch: fresh.etag });
          if (!finalized?.modified) {
            const e = new Error("Stock was released but the checkout cancellation state changed concurrently. Please retry once.");
            e.statusCode = 503;
            e.retryAfter = "2";
            throw e;
          }
        }
        cachedAvailabilityUntil = 0;
        return {
          success: true,
          replayed: currentState === "cancelled_customer",
          state: "cancelled_customer",
          paymentReference,
          reservationsReleased: releasedCount,
          totalQuantityReleased: order.items.reduce((sum, line) => sum + Number(line.quantity || 0), 0),
          message: "Order cancelled. Reserved stock has been released back to the shop."
        };
      } finally {
        await releasePaymentConfirmationLock(lock);
      }
    }
    __name(cancelBankCheckoutByCustomer, "cancelBankCheckoutByCustomer");
    function customerOrderStatusMessage(state) {
      const value = String(state || "");
      if (value === "confirmed") return { status: "confirmed", title: "Order confirmed", message: "Your payment has been verified and your order is confirmed." };
      if (value === "pending_payment") return { status: "pending", title: "Awaiting payment verification", message: "Your order is reserved and is still awaiting payment verification." };
      if (value === "confirming_payment") return { status: "pending", title: "Payment verification in progress", message: "Your payment is currently being verified." };
      if (value === "cancelled_customer" || value === "cancelled_unpaid") return { status: "cancelled", title: "Order cancelled", message: "This order has been cancelled and its website stock reservation has been released." };
      if (value === "expired") return { status: "expired", title: "Reservation expired", message: "The payment reservation expired before the order was confirmed." };
      if (value === "cancelling_customer" || value === "cancelling_unpaid_admin") return { status: "cancelled", title: "Cancellation in progress", message: "This order is being closed and its reservation is being released." };
      return { status: "pending", title: "Order being reviewed", message: "This order is being reviewed. Please check again shortly." };
    }
    __name(customerOrderStatusMessage, "customerOrderStatusMessage");
    async function publicBankOrderStatus(paymentReference, email) {
      const ref = validatePaymentReference(paymentReference);
      const normalizedEmail = cleanText(email, 160).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        const e = new Error("Enter the email address used for this order.");
        e.statusCode = 400;
        throw e;
      }
      let located = null;
      let current = null;
      try {
        located = await locateBankCheckoutByReference(ref);
        current = await located.store.getWithMetadata(located.key, { type: "json", consistency: "strong" });
      } catch (_) {
      }
      const storedEmail = cleanText(current?.data?.progress?.customer?.email, 160).toLowerCase();
      if (!current || !storedEmail || !safeEqual(storedEmail, normalizedEmail)) {
        const e = new Error("We could not match that order reference and email address.");
        e.statusCode = 404;
        throw e;
      }
      const data = current.data || {};
      const progress = data.progress || {};
      const response = data.response || {};
      const state = String(data.state || "");
      const deliveryMethod = validateDeliveryMethod(progress.deliveryMethod || response?.order?.deliveryMethod || DELIVERY_METHOD_COURIER);
      const fulfilment = normaliseFulfilmentRecord(data, deliveryMethod);
      let display = customerOrderStatusMessage(state);
      if (state === "confirmed") {
        if (fulfilment.state === "preparing") display = { status: "processing", title: "Order being prepared", message: "Payment is confirmed and your order is being prepared." };
        else if (fulfilment.state === "ready_for_collection") display = { status: "ready", title: "Ready for collection", message: "Your order is ready for collection from Vestige Ltd." };
        else if (fulfilment.state === "dispatched") display = { status: "dispatched", title: "Order dispatched", message: "Your order has been handed to The Courier Guy for locker-to-locker delivery." };
        else if (fulfilment.state === "completed") display = { status: "completed", title: deliveryMethod === DELIVERY_METHOD_COLLECTION ? "Order collected" : "Order completed", message: deliveryMethod === DELIVERY_METHOD_COLLECTION ? "Your order has been collected and is complete." : "Your order has been marked delivered and complete." };
      }
      const methodLabel = deliveryMethod === DELIVERY_METHOD_COLLECTION ? "Collection from Vestige Ltd" : "The Courier Guy — Locker to Locker";
      const fulfilmentLabelText = state === "confirmed" ? `${fulfilmentLabel(fulfilment.state, deliveryMethod)} · ${methodLabel}` : methodLabel;
      return {
        paymentReference: ref,
        status: display.status,
        title: display.title,
        message: display.message,
        amount: Number(progress.amount || response?.order?.amount || 0),
        totalQuantity: Number(progress.totalQuantity || response?.order?.totalQuantity || 0),
        fulfilment: fulfilmentLabelText,
        fulfilmentState: state === "confirmed" ? fulfilment.state : null,
        trackingReference: deliveryMethod === DELIVERY_METHOD_COURIER ? fulfilment.trackingReference : null,
        paymentExpiresAt: Number(progress.paymentExpiresAt || 0) || null,
        updatedAt: Number(fulfilment.updatedAt || data.updatedAt || 0) || null
      };
    }
    __name(publicBankOrderStatus, "publicBankOrderStatus");
    async function getBankCheckoutStatus(token) {
      const checkout = verifyCheckout(token, { allowPaidVerificationGrace: true });
      if (checkout.paymentMode !== "bank_transfer") {
        const e = new Error("This checkout token is not a bank-payment checkout.");
        e.statusCode = 400;
        throw e;
      }
      const store = await getCheckoutStore();
      const current = await store.getWithMetadata(`checkout-${checkout.checkoutId}`, { type: "json", consistency: "strong" });
      if (!current) {
        const e = new Error("Checkout could not be found.");
        e.statusCode = 404;
        throw e;
      }
      const state = String(current.data?.state || "");
      const progress = current.data?.progress || {};
      let ownerAlertStatus = null;
      try {
        const notificationStore = await getNotificationStore();
        const alert = await notificationStore.getWithMetadata(`payment-claimed:${checkout.paymentReference}`, { type: "json", consistency: "strong" });
        ownerAlertStatus = alert ? String(alert.data?.status || "") || null : null;
      } catch (_) {
      }
      return {
        checkoutId: checkout.checkoutId,
        paymentReference: checkout.paymentReference,
        amount: Number(checkout.amount),
        state,
        paymentClaimedAt: Number(progress.paymentClaimedAt || 0) || null,
        ownerAlertStatus,
        paymentStatus: state === "confirmed" ? "confirmed" : state === "expired" ? "expired" : state === "cancelled_customer" || state === "cancelled_unpaid" ? "cancelled" : "pending"
      };
    }
    __name(getBankCheckoutStatus, "getBankCheckoutStatus");
    async function claimBankPayment(checkoutToken, requestId) {
      const checkout = verifyCheckout(checkoutToken, { allowPaidVerificationGrace: true });
      if (checkout.paymentMode !== "bank_transfer") {
        const e = new Error("This checkout token is not a bank-payment checkout.");
        e.statusCode = 400;
        throw e;
      }
      const ref = validatePaymentReference(checkout.paymentReference);
      const located = await locateBankCheckoutByReference(ref);
      let current = await located.store.getWithMetadata(located.key, { type: "json", consistency: "strong" });
      if (!current) {
        const e = new Error("Checkout could not be found.");
        e.statusCode = 404;
        throw e;
      }
      const state = String(current.data?.state || "");
      if (state === "confirmed") {
        return { success: true, paymentReference: ref, state, alreadyConfirmed: true, message: "This order is already confirmed." };
      }
      if (!["pending_payment", "confirming_payment"].includes(state)) {
        const e = new Error("This order is no longer awaiting payment verification.");
        e.statusCode = 409;
        throw e;
      }
      let progress = current.data?.progress || {};
      const originalExpiry = Number(progress.paymentExpiresAt || 0);
      const existingClaimedAt = Number(progress.paymentClaimedAt || 0);
      if (!existingClaimedAt && originalExpiry > 0 && Date.now() > originalExpiry) {
        const e = new Error("The payment reservation has already expired. Please contact Vestige before attempting another payment action.");
        e.statusCode = 409;
        throw e;
      }
      const claimedAt = existingClaimedAt || Date.now();
      if (!existingClaimedAt) {
        const updated = {
          ...current.data,
          progress: {
            ...progress,
            paymentClaimedAt: claimedAt,
            paymentClaimSource: "customer_button"
          },
          updatedAt: Date.now()
        };
        const written = await located.store.setJSON(located.key, updated, { onlyIfMatch: current.etag });
        if (!written?.modified) {
          const e = new Error("The order changed while the payment notice was being recorded. Please press the button once more.");
          e.statusCode = 503;
          e.retryAfter = "2";
          throw e;
        }
      }
      current = await located.store.getWithMetadata(located.key, { type: "json", consistency: "strong" });
      if (!current) {
        const e = new Error("Checkout could not be found after payment notice was recorded.");
        e.statusCode = 409;
        throw e;
      }
      progress = current.data?.progress || {};
      const order = storedBankOrderFromCheckout(located.checkoutId, current.data);
      for (const line of order.items) {
        await placePaymentReviewHold(
          line.itemId,
          located.checkoutId,
          line.quantity,
          claimedAt
        );
      }
      if (!progress.paymentReviewHoldAt) {
        const heldRecord = {
          ...current.data,
          progress: {
            ...progress,
            paymentClaimedAt: claimedAt,
            paymentClaimSource: "customer_button",
            paymentReviewHoldAt: claimedAt,
            paymentReviewHoldStatus: "awaiting_owner_verification"
          },
          updatedAt: Date.now()
        };
        const heldWrite = await located.store.setJSON(located.key, heldRecord, { onlyIfMatch: current.etag });
        if (!heldWrite?.modified) {
          const e = new Error("The payment notice was recorded but the owner-review status changed concurrently. Please press the button once more.");
          e.statusCode = 503;
          e.retryAfter = "2";
          throw e;
        }
      }
      const refreshed = await located.store.getWithMetadata(located.key, { type: "json", consistency: "strong" });
      const summary = publicAdminOrderSummary(
        { checkoutId: located.checkoutId, paymentReference: ref },
        refreshed || current
      );
      const customerName = summary.customer?.name || "Customer";
      const notification = await notifyOwnerOnce(
        "payment-claimed",
        ref,
        `ACTION REQUIRED \u2014 ${ref} customer says paid`,
        `A Vestige customer has reported that payment was sent.

Order: ${ref}
Customer: ${customerName}
Amount: ${moneyForError(summary.amount)}
Items: ${summary.totalQuantity}
Fulfilment: ${deliveryLabelFor(summary.deliveryMethod)}

STOCK STATUS: The customer's reserved items are now held for OWNER PAYMENT REVIEW and will not return to sale until you confirm payment or void the unpaid order.

IMPORTANT: This is not proof of payment. Check the actual bank account and confirm only if the exact cleared credit is visible.

Owner Console:
${ownerConsoleUrl()}`
      );
      await writeAuditEvent({
        action: "customer_payment_claimed",
        actor: "customer",
        paymentReference: ref,
        outcome: notification.sent ? "owner_alert_sent" : "recorded",
        message: notification.sent ? "Customer reported payment sent; stock placed on owner payment review hold; owner alert delivered." : "Customer reported payment sent; stock placed on owner payment review hold; owner alert could not be delivered.",
        requestId,
        amount: summary.amount
      });
      cachedAvailabilityUntil = 0;
      return {
        success: true,
        paymentReference: ref,
        state,
        paymentClaimedAt: claimedAt,
        paymentReviewHold: true,
        ownerAlertSent: Boolean(notification.sent),
        ownerAlertPending: Boolean(notification.pending),
        message: notification.sent ? "Vestige has been notified that you sent payment. Your reserved items will remain held while the cleared bank credit is verified. Your order is not confirmed until verification is complete." : notification.pending ? "Your payment notice is recorded and the owner alert is still being processed. Your reserved items remain held. If this message persists, press the payment notice button again." : "Your payment notice is recorded and your reserved items remain held, but the automatic owner alert could not be confirmed. Please press the payment notice button again or contact Vestige Ltd. Your order is not yet confirmed."
      };
    }
    __name(claimBankPayment, "claimBankPayment");
    async function prepareBankOrder(order, requestId) {
      checkoutSigningSecret();
      const checkoutAttempt = await beginCheckoutAttempt(order);
      if (checkoutAttempt.replay) return { ...checkoutAttempt.replay, replayed: true, requestId };
      const locks = [];
      const reservedItemIds = [];
      try {
        for (const line of order.items) {
          const preflight = await requireCheckoutStockState(line);
          if (String(preflight.item.item_id) !== String(line.itemId)) {
            const e = new Error(`${line.flavour} no longer matches the Zoho Books item catalogue. Please refresh the shop.`);
            e.statusCode = 409;
            throw e;
          }
        }
        const lockLines = [...order.items].sort((a, b) => String(a.itemId).localeCompare(String(b.itemId)));
        for (const line of lockLines) {
          const lock = await acquireStockLock(line.itemId, order.checkoutId);
          locks.push(lock);
        }
        for (const lock of locks) await renewDistributedLock(lock);
        const finalLines = [];
        for (const line of order.items) {
          const finalStock = await requireCheckoutStockState(line);
          const snapshot = await applyWebsiteReservationOverlay(finalStock.snapshot, line.itemId, order.checkoutId);
          if (!snapshot.canFulfil) {
            const e = new Error(snapshot.stock === 0 ? `${line.flavour} has just been reserved by another customer and is now unavailable.` : `Only ${snapshot.stock} unit(s) of ${line.flavour} remain after active website reservations. Please lower that quantity or remove the flavour.`);
            e.statusCode = 409;
            e.freshAvailabilityNeeded = true;
            throw e;
          }
          finalLines.push({ line, snapshot });
        }
        for (const { line, snapshot } of finalLines) {
          await addWebsiteReservation({ checkoutId: order.checkoutId, itemId: line.itemId, quantity: line.quantity }, snapshot, null);
          reservedItemIds.push(line.itemId);
        }
        const existingProgress = checkoutAttempt.progress || {};
        const paymentReference = cleanText(existingProgress.paymentReference, 24) || await allocateBankPaymentReference();
        await indexBankPaymentReference(paymentReference, order.checkoutId);
        const paymentExpiresAt = Date.now() + BANK_PAYMENT_WINDOW_MS;
        const checkoutToken = signCheckout({
          checkoutId: order.checkoutId,
          paymentMode: "bank_transfer",
          paymentReference,
          amount: order.amount,
          items: order.items,
          totalQuantity: order.totalQuantity,
          exp: paymentExpiresAt,
          verifyUntil: paymentExpiresAt + PAYMENT_VERIFICATION_GRACE_MS
        });
        await saveCheckoutProgress(checkoutAttempt, {
          paymentMode: "bank_transfer",
          paymentReference,
          paymentExpiresAt,
          items: order.items,
          totalQuantity: order.totalQuantity,
          amount: order.amount,
          deliveryMethod: order.deliveryMethod,
          deliveryCharge: order.deliveryCharge,
          courierLocker: order.courierLocker,
          customer: {
            customerName: order.customerName,
            email: order.email,
            mobile: order.mobile,
            addressLine1: order.addressLine1,
            addressLine2: order.addressLine2,
            city: order.city,
            province: order.province,
            postalCode: order.postalCode,
            country: order.country
          }
        });
        const newOrderAlert = await notifyOwnerOnce(
          "new-order",
          paymentReference,
          `NEW VESTIGE ORDER \u2014 ${paymentReference}`,
          `A new Vestige bank-payment checkout has been created.

Order: ${paymentReference}
Customer: ${order.customerName}
Email: ${order.email}
Amount: ${moneyForError(order.amount)}
Items: ${order.totalQuantity}
Fulfilment: ${deliveryLabelFor(order.deliveryMethod)}

Payment has NOT yet been verified.

Owner Console:
${ownerConsoleUrl()}`
        );
        await writeAuditEvent({
          action: "owner_new_order_notification",
          actor: "system",
          paymentReference,
          outcome: newOrderAlert.sent ? "success" : "not_sent",
          message: newOrderAlert.sent ? "Owner new-order email delivered." : "Owner new-order email not delivered.",
          requestId,
          amount: order.amount
        });
        const responsePayload = {
          success: true,
          pendingPayment: true,
          paymentMode: "bank_transfer",
          paymentReference,
          checkoutToken,
          paymentExpiresAt,
          expiresInMinutes: Math.round(BANK_PAYMENT_WINDOW_MS / 6e4),
          message: "Your basket is reserved for 30 minutes. Pay the exact total by Capitec QR Pay or EFT. Your order remains pending until the actual bank payment is verified.",
          capitec: {
            available: true,
            qrImageUrl: "/assets/capitec-pay-me.png",
            note: "Scan this QR with the Capitec app. The QR is static; use the short Vestige payment reference shown separately where your banking flow allows it."
          },
          eft: publicEftDetails(),
          order: {
            items: order.items,
            totalQuantity: order.totalQuantity,
            amount: order.amount,
            deliveryMethod: order.deliveryMethod,
            deliveryLabel: deliveryLabelFor(order.deliveryMethod),
            deliveryCharge: order.deliveryCharge,
            courierLocker: order.deliveryMethod === DELIVERY_METHOD_COURIER ? order.courierLocker : null
          }
        };
        await saveCheckoutPending(checkoutAttempt, responsePayload);
        cachedAvailabilityUntil = 0;
        return { ...responsePayload, requestId };
      } catch (error) {
        for (const itemId of reservedItemIds) await releaseWebsiteReservation(itemId, order.checkoutId);
        await markCheckoutFailed(checkoutAttempt, error.message);
        cachedAvailabilityUntil = 0;
        if (error.statusCode !== 503 && error.statusCode !== 504) {
          try {
            error.freshAvailability = await getProductAvailability(true, false);
          } catch (_) {
          }
        }
        throw error;
      } finally {
        for (const lock of locks.reverse()) await releaseStockLock(lock);
      }
    }
    __name(prepareBankOrder, "prepareBankOrder");
    function signCheckout(payload) {
      const secret = checkoutSigningSecret();
      const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const sig = createHmac("sha256", secret).update(encoded).digest("base64url");
      return `${encoded}.${sig}`;
    }
    __name(signCheckout, "signCheckout");
    function verifyCheckout(token, { allowPaidVerificationGrace = false } = {}) {
      const [encoded, supplied] = String(token || "").split(".");
      if (!encoded || !supplied) {
        const e = new Error("Invalid checkout token.");
        e.statusCode = 401;
        throw e;
      }
      const expected = createHmac("sha256", checkoutSigningSecret()).update(encoded).digest("base64url");
      if (!safeEqual(supplied, expected)) {
        const e = new Error("Invalid checkout token.");
        e.statusCode = 401;
        throw e;
      }
      let payload;
      try {
        payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      } catch {
        const e = new Error("Invalid checkout token.");
        e.statusCode = 401;
        throw e;
      }
      const now = Date.now();
      if (!payload.exp) {
        const e = new Error("Invalid checkout token.");
        e.statusCode = 401;
        throw e;
      }
      if (now > Number(payload.exp)) {
        const verifyUntil = Number(payload.verifyUntil || payload.exp);
        if (!allowPaidVerificationGrace || now > verifyUntil) {
          const e = new Error("Checkout session expired. Please start again.");
          e.statusCode = 410;
          throw e;
        }
      }
      return payload;
    }
    __name(verifyCheckout, "verifyCheckout");
    async function verifiedSuccessfulPayments(invoiceId, expectedAmount) {
      const paymentData = await zohoRequest(`/invoices/${encodeURIComponent(invoiceId)}/payments?${organizationQuery()}`);
      const summaries = Array.isArray(paymentData.payments) ? paymentData.payments : [];
      const byId = /* @__PURE__ */ new Map();
      for (const summary of summaries) {
        const id = String(summary.payment_id || "");
        if (id && !byId.has(id)) byId.set(id, summary);
      }
      if (!byId.size) return { successTotal: 0, paymentIds: [], primaryPaymentId: null, onlineTransactionId: null };
      const successful = [];
      for (const [paymentId, summary] of byId) {
        const data = await zohoRequest(`/customerpayments/${encodeURIComponent(paymentId)}?${organizationQuery()}`);
        const payment = data.payment || {};
        if (String(payment.status || "").toLowerCase() !== "success") continue;
        if (Number(payment.amount_refunded || 0) > PAYMENT_EPSILON) {
          const e = new Error("The recorded payment has been refunded and cannot confirm this order.");
          e.statusCode = 409;
          throw e;
        }
        const onlineTransactionId = String(summary.online_transaction_id || payment.online_transaction_id || "").trim();
        if (!onlineTransactionId) continue;
        const mode = String(payment.payment_mode || summary.payment_mode || "").trim().toLowerCase();
        const onlineMode = !mode || ["paypal", "autotransaction", "onlinepayment", "online payment"].includes(mode);
        if (!onlineMode) continue;
        const allocations = Array.isArray(payment.invoices) ? payment.invoices : [];
        const matching = allocations.filter((i) => String(i.invoice_id || "") === String(invoiceId));
        const applied = matching.reduce((sum, i) => sum + (Number(i.amount_applied) || 0), 0);
        if (applied <= 0) continue;
        successful.push({ paymentId, applied, onlineTransactionId, mode });
      }
      const successTotal = successful.reduce((sum, p) => sum + p.applied, 0);
      if (successTotal > Number(expectedAmount) + PAYMENT_EPSILON) {
        const e = new Error("Payment records exceed the expected invoice amount and require manual review.");
        e.statusCode = 409;
        throw e;
      }
      if (successful.length > 1) {
        const e = new Error("Multiple successful payments are attached to this full-payment-only invoice. Manual review is required.");
        e.statusCode = 409;
        throw e;
      }
      const only = successful[0] || null;
      if (only && Math.abs(Number(only.applied) - Number(expectedAmount)) > PAYMENT_EPSILON) {
        return { successTotal, paymentIds: [only.paymentId], primaryPaymentId: null, onlineTransactionId: only.onlineTransactionId };
      }
      return {
        successTotal,
        paymentIds: only ? [only.paymentId] : [],
        primaryPaymentId: only?.paymentId || null,
        onlineTransactionId: only?.onlineTransactionId || null
      };
    }
    __name(verifiedSuccessfulPayments, "verifiedSuccessfulPayments");
    async function verifyDirectInvoiceAtPayment(checkout) {
      const invoice = await getInvoice(checkout.invoiceId);
      if (!invoice || String(invoice.invoice_id || "") !== String(checkout.invoiceId)) {
        const e = new Error("Invoice could not be re-verified before confirmation.");
        e.statusCode = 409;
        throw e;
      }
      if (isVoidedStatus(invoice.status)) {
        const e = new Error("The invoice has been voided and cannot be confirmed.");
        e.statusCode = 409;
        throw e;
      }
      if (String(invoice.reference_number || "") !== webReference(checkout.checkoutId)) {
        const e = new Error("Invoice checkout reference no longer matches.");
        e.statusCode = 409;
        throw e;
      }
      const lines = Array.isArray(invoice.line_items) ? invoice.line_items : [];
      const productLines = lines.filter((line) => String(line.item_id || "") === String(checkout.itemId || ""));
      if (productLines.length !== 1 || Math.abs(Number(productLines[0].quantity) - Number(checkout.quantity)) > PAYMENT_EPSILON || Math.abs(Number(productLines[0].rate) - PRODUCT_PRICE_ZAR) > PAYMENT_EPSILON) {
        const e = new Error("Invoice product details changed after checkout and require manual review.");
        e.statusCode = 409;
        throw e;
      }
      if (Math.abs(Number(invoice.shipping_charge || 0) - DELIVERY_PRICE_ZAR) > PAYMENT_EPSILON) {
        const e = new Error("Invoice delivery charge changed after checkout.");
        e.statusCode = 409;
        throw e;
      }
      return invoice;
    }
    __name(verifyDirectInvoiceAtPayment, "verifyDirectInvoiceAtPayment");
    async function verifyPaymentAndOrder(token) {
      const checkout = verifyCheckout(token, { allowPaidVerificationGrace: true });
      const invoice = await verifyDirectInvoiceAtPayment(checkout);
      if (Math.abs(Number(invoice.total) - Number(checkout.amount)) > PAYMENT_EPSILON) {
        const e = new Error("Invoice amount does not match the checkout total.");
        e.statusCode = 409;
        throw e;
      }
      if (invoice.allow_partial_payments !== false) {
        const e = new Error("The invoice is not configured for full-payment-only checkout.");
        e.statusCode = 409;
        throw e;
      }
      if (!isPaypalConfigured(invoice)) {
        const e = new Error("PayPal is not confirmed as active for this invoice.");
        e.statusCode = 409;
        throw e;
      }
      const balance = Number(invoice.balance);
      if (String(invoice.status || "").toLowerCase() !== "paid" || !Number.isFinite(balance) || Math.abs(balance) > PAYMENT_EPSILON) {
        const e = new Error("Full payment has not yet been confirmed by Zoho Books.");
        e.statusCode = 402;
        throw e;
      }
      const proof = await verifiedSuccessfulPayments(checkout.invoiceId, checkout.amount);
      if (Math.abs(proof.successTotal - Number(checkout.amount)) > PAYMENT_EPSILON || !proof.primaryPaymentId || !proof.onlineTransactionId) {
        const e = new Error("A successful online PayPal payment for the exact invoice total has not yet been verified.");
        e.statusCode = 402;
        throw e;
      }
      const verified = {
        invoiceNumber: invoice.invoice_number || checkout.invoiceNumber,
        amount: Number(checkout.amount),
        paidTotal: proof.successTotal,
        paymentId: proof.primaryPaymentId
      };
      await markCheckoutConfirmed(checkout, verified);
      await bridgeConfirmedWebsiteReservation(checkout.itemId, checkout.checkoutId);
      return verified;
    }
    __name(verifyPaymentAndOrder, "verifyPaymentAndOrder");
    async function buildReceiptResponse(token, requestId) {
      const verified = await verifyPaymentAndOrder(token);
      const pdf = await zohoPdf(`/customerpayments/${encodeURIComponent(verified.paymentId)}?${organizationQuery({ accept: "pdf" })}`);
      const filename = `Vestige-Payment-Receipt-${String(verified.invoiceNumber || "payment").replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`;
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          "X-Vestige-Request-Id": requestId
        },
        body: pdf.toString("base64"),
        isBase64Encoded: true
      };
    }
    __name(buildReceiptResponse, "buildReceiptResponse");
    exports.handler = /* @__PURE__ */ __name(async function handler(event) {
      const requestId = randomUUID();
      let diagnosticStage = null;
      if (event.path && event.path !== "/api/zoho") return publicError(404, "Not found.", requestId);
      if (event.httpMethod !== "POST") return publicError(405, "Method not allowed.", requestId, { Allow: "POST" });
      if (!isAllowedBrowserOrigin(event)) return publicError(403, "Origin not allowed.", requestId);
      const contentType = String(event.headers?.["content-type"] || event.headers?.["Content-Type"] || "").toLowerCase();
      if (!contentType.includes("application/json")) return publicError(415, "Content-Type must be application/json.", requestId);
      try {
        requireEnv("ZOHO_CLIENT_ID");
        requireEnv("ZOHO_CLIENT_SECRET");
        requireEnv("ZOHO_REFRESH_TOKEN");
        requireEnv("ZOHO_ORGANIZATION_ID");
        const body = parseJsonBody(event);
        if (body.action === "availability") {
          const [availability, catalogue] = await Promise.all([
            getProductAvailability(false, false, true),
            getPublicInventoryCatalogue(false, false)
          ]);
          return json(200, { success: true, availability, catalogue, verifiedAt: (/* @__PURE__ */ new Date()).toISOString(), requestId });
        }
        if (body.action === "connection_test") {
          const expected = requireEnv("ZOHO_ADMIN_TEST_KEY");
          const supplied = event.headers?.["x-vestige-admin-key"] || event.headers?.["X-Vestige-Admin-Key"];
          if (!safeEqual(supplied, expected)) return publicError(401, "Unauthorized.", requestId);
          diagnosticStage = "ZOHO_OAUTH_REFRESH";
          await getAccessToken();
          diagnosticStage = "ZOHO_ORGANIZATIONS_API";
          const data = await zohoRequest("/organizations");
          diagnosticStage = "ORGANIZATION_VERIFY";
          const organizationId = requireEnv("ZOHO_ORGANIZATION_ID");
          const org = Array.isArray(data.organizations) ? data.organizations.find((o) => String(o.organization_id) === organizationId) : null;
          if (!org) return publicError(403, "Configured Zoho Books organization could not be verified.", requestId);
          diagnosticStage = "STOCK_MAPPING";
          const availability = await getProductAvailability(true, true);
          diagnosticStage = "D1_STORAGE";
          const checkoutStorage = await testCheckoutStorage();
          diagnosticStage = "COMPLETE";
          const stockConnection = Object.fromEntries(Object.entries(availability).map(([flavour, state]) => [flavour, { available: state.available, stock: state.stock, reason: state.reason || null, itemId: resolvedProductItemIds.get(flavour) || null, itemName: state.itemName || null, price: state.price, locationId: state.locationId || null, locationName: state.locationName || null, stockSource: state.stockSource || null }]));
          return json(200, {
            success: true,
            message: "Zoho Books, BC10000 stock mapping, fixed R60 delivery charge, direct-invoice checkout and secure checkout storage confirmed.",
            organization: { organizationId, organizationName: org.name || null },
            stockConnection,
            delivery: { verified: true, method: DELIVERY_METHOD_NAME, shippingCharge: DELIVERY_PRICE_ZAR, source: "server-fixed" },
            checkoutStorage,
            requestId
          });
        }
        if (body.action === "admin_order_lookup") {
          requirePaymentAdmin(event);
          const order2 = await adminLookupBankOrder(body.paymentReference);
          return json(200, { success: true, order: order2, requestId });
        }
        if (body.action === "admin_update_fulfilment") {
          requirePaymentAdmin(event);
          try {
            const result = await adminUpdateFulfilment(body, requestId);
            return json(200, { ...result, requestId });
          } catch (error) {
            await writeAuditEvent({
              action: "admin_update_fulfilment",
              actor: "owner",
              paymentReference: cleanText(body?.paymentReference, 24).toUpperCase() || null,
              outcome: "failed",
              requestId,
              message: error?.message || "Fulfilment update failed."
            });
            throw error;
          }
        }
        if (body.action === "admin_recent_orders") {
          requirePaymentAdmin(event);
          const orders = await adminRecentBankOrders(body.limit);
          return json(200, { success: true, orders, requestId });
        }
        if (body.action === "admin_stock_dashboard") {
          requirePaymentAdmin(event);
          const stock = await adminStockDashboard();
          return json(200, { success: true, stock, verifiedAt: (/* @__PURE__ */ new Date()).toISOString(), requestId });
        }
        if (body.action === "admin_preview_stock_adjustment") {
          requirePaymentAdmin(event);
          const preview = await adminPreviewStockAdjustment(body);
          return json(200, { success: true, preview, requestId });
        }
        if (body.action === "admin_apply_stock_adjustment") {
          requirePaymentAdmin(event);
          const result = await adminApplyStockAdjustment(body, requestId);
          return json(200, { ...result, requestId });
        }
        if (body.action === "admin_cancel_unpaid_bank_order") {
          requirePaymentAdmin(event);
          const ref = validatePaymentReference(body.paymentReference);
          await writeAuditEvent({ action: "admin_cancel_unpaid_order", actor: "owner", paymentReference: ref, outcome: "attempt", requestId });
          try {
            const cancelled = await adminCancelUnpaidBankOrder(ref);
            await writeAuditEvent({
              action: "admin_cancel_unpaid_order",
              actor: "owner",
              paymentReference: ref,
              outcome: "success",
              message: cancelled.message,
              requestId,
              reservationsReleased: cancelled.reservationsReleased
            });
            return json(200, { ...cancelled, requestId });
          } catch (error) {
            await writeAuditEvent({
              action: "admin_cancel_unpaid_order",
              actor: "owner",
              paymentReference: ref,
              outcome: "failed",
              message: error?.message || "Owner unpaid-order cancellation failed.",
              requestId
            });
            throw error;
          }
        }
        if (body.action === "admin_preview_test_order_reset") {
          requirePaymentAdmin(event);
          const preview = await adminPreviewTestOrderReset();
          return json(200, { success: true, preview, requestId });
        }
        if (body.action === "admin_apply_test_order_reset") {
          requirePaymentAdmin(event);
          const result = await adminApplyTestOrderReset(body);
          return json(200, { ...result, requestId });
        }
        if (body.action === "admin_order_exceptions") {
          requirePaymentAdmin(event);
          const exceptions = await adminOrderExceptions(body.limit);
          return json(200, {
            success: true,
            exceptions,
            summary: {
              critical: exceptions.filter((item) => item.severity === "critical").length,
              warning: exceptions.filter((item) => item.severity === "warning").length,
              total: exceptions.length
            },
            checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
            requestId
          });
        }
        if (body.action === "admin_notification_test") {
          requirePaymentAdmin(event);
          const sent = await sendOwnerTestNotification();
          await writeAuditEvent({
            action: "admin_notification_test",
            actor: "owner",
            outcome: sent.sent ? "success" : "failed",
            message: sent.sent ? "Owner test notification delivered." : sent.message || "Owner test notification failed.",
            requestId
          });
          if (!sent.sent) return publicError(503, sent.message || sent.error || "Owner email notification is not configured.", requestId);
          return json(200, { success: true, message: "Test owner notification sent.", messageId: sent.messageId || null, requestId });
        }
        if (body.action === "admin_recent_audit_events") {
          requirePaymentAdmin(event);
          const events = await adminRecentAuditEvents(body.limit);
          return json(200, { success: true, events, requestId });
        }
        if (body.action === "admin_bank_confirmation_health") {
          requirePaymentAdmin(event);
          await getAccessToken();
          return json(200, { success: true, ready: true, paymentAdminSecretConfigured: true, zohoBankAccountMapped: Boolean(cleanText(runtimeEnv("ZOHO_BANK_ACCOUNT_ID"), 40)), ownerNotificationsConfigured: ownerNotificationConfigured(), notificationProvider: "resend", requestId });
        }
        if (body.action === "admin_confirm_bank_payment") {
          requirePaymentAdmin(event);
          const ref = validatePaymentReference(body.paymentReference);
          await writeAuditEvent({
            action: "admin_confirm_bank_payment",
            actor: "owner",
            paymentReference: ref,
            outcome: "attempt",
            requestId,
            amount: body.amount
          });
          try {
            const confirmed = await confirmBankPaymentManually({ ...body, paymentReference: ref });
            const message = confirmed.replayed ? "This bank payment was already confirmed; no duplicate Zoho records were created." : "Bank credit confirmed. Zoho invoice and customer payment are recorded and the order is confirmed.";
            await writeAuditEvent({
              action: "admin_confirm_bank_payment",
              actor: "owner",
              paymentReference: ref,
              outcome: confirmed.replayed ? "replayed" : "success",
              message,
              requestId,
              amount: body.amount,
              invoiceId: confirmed.invoiceId || confirmed.bankInvoiceId,
              paymentId: confirmed.paymentId || confirmed.bankPaymentId
            });
            return json(200, { ...confirmed, message, requestId });
          } catch (error) {
            await writeAuditEvent({
              action: "admin_confirm_bank_payment",
              actor: "owner",
              paymentReference: ref,
              outcome: "failed",
              message: error?.message || "Bank payment confirmation failed.",
              requestId,
              amount: body.amount
            });
            throw error;
          }
        }
        if (body.action === "verify_collection_access") {
          const token = issueCollectionAccessToken(body.checkoutId, body.code);
          return json(200, {
            success: true,
            collectionAccessToken: token,
            expiresInMinutes: 15,
            message: "Collection access approved for this checkout.",
            requestId
          });
        }
        if (body.action === "public_order_status") {
          const status = await publicBankOrderStatus(body.paymentReference, body.email);
          return json(200, { success: true, order: status, requestId });
        }
        if (body.action === "prepare_bank_order") {
          const order2 = validateBankCartOrder(body);
          const prepared = await prepareBankOrder(order2, requestId);
          await writeAuditEvent({
            action: "bank_order_created",
            actor: "customer",
            paymentReference: prepared.paymentReference,
            outcome: "success",
            message: "Bank checkout created and website stock reserved.",
            requestId,
            amount: prepared?.order?.amount
          });
          return json(200, prepared);
        }
        if (body.action === "claim_bank_payment") {
          const claimed = await claimBankPayment(body.checkoutToken, requestId);
          return json(200, { ...claimed, requestId });
        }
        if (body.action === "bank_payment_status") {
          const status = await getBankCheckoutStatus(body.checkoutToken);
          return json(200, { success: true, ...status, requestId });
        }
        if (body.action === "cancel_bank_order") {
          const cancelled = await cancelBankCheckoutByCustomer(body.checkoutToken);
          await writeAuditEvent({
            action: "customer_cancel_order",
            actor: "customer",
            paymentReference: cancelled.paymentReference,
            outcome: "success",
            message: cancelled.message,
            requestId,
            reservationsReleased: cancelled.reservationsReleased
          });
          return json(200, { ...cancelled, requestId });
        }
        if (body.action === "verify_payment") {
          const verified = await verifyPaymentAndOrder(body.checkoutToken);
          return json(200, { success: true, message: "Full PayPal payment verified in Zoho Books. Your order is confirmed.", order: verified, receiptAvailable: true, requestId });
        }
        if (body.action === "payment_receipt") {
          return await buildReceiptResponse(body.checkoutToken, requestId);
        }
        if (body.action !== "prepare_order") return publicError(400, "Unknown action.", requestId);
        checkoutSigningSecret();
        const order = validateOrder(body);
        const checkoutAttempt = await beginCheckoutAttempt(order);
        if (checkoutAttempt.replay) {
          return json(200, { ...checkoutAttempt.replay, replayed: true, requestId });
        }
        let stockLock = null;
        let invoice = null;
        let createdInvoiceThisAttempt = false;
        try {
          diagnosticStage = "CHECKOUT_STOCK_PREFLIGHT";
          const preflight = await requireStockState(order.flavour, order.quantity, order.itemId);
          if (String(preflight.item.item_id) !== String(order.itemId)) {
            const e = new Error("The selected product no longer matches the Zoho Books item catalogue. Please refresh the shop.");
            e.statusCode = 409;
            throw e;
          }
          let customerLock = null;
          let customer;
          try {
            customerLock = await acquireCustomerLock(order.email, order.checkoutId);
            diagnosticStage = "CHECKOUT_CUSTOMER_SYNC";
            customer = await syncCustomer(order);
          } finally {
            await releaseStockLock(customerLock);
          }
          stockLock = await acquireStockLock(order.itemId, order.checkoutId);
          await renewDistributedLock(stockLock);
          const reference = webReference(order.checkoutId);
          diagnosticStage = "CHECKOUT_INVOICE_RECOVERY";
          invoice = await findRecoverableDirectInvoice(order, customer, reference, checkoutAttempt.progress || {});
          let beforeSnapshot = null;
          let productItem = null;
          if (!invoice) {
            const finalStock = await requireStockState(order.flavour, order.quantity, order.itemId);
            productItem = finalStock.item;
            beforeSnapshot = await applyWebsiteReservationOverlay(finalStock.snapshot, order.itemId, order.checkoutId);
            if (!beforeSnapshot.canFulfil) {
              const e = new Error(beforeSnapshot.stock === 0 ? "This flavour has just been reserved by another customer and is now unavailable." : `Only ${beforeSnapshot.stock} unit(s) remain after active website reservations. Please lower the quantity or choose another flavour.`);
              e.statusCode = 409;
              e.freshAvailabilityNeeded = true;
              throw e;
            }
            await renewDistributedLock(stockLock);
            diagnosticStage = "CHECKOUT_INVOICE_CREATE";
            invoice = await createDirectInvoice(order, customer, productItem, reference, beforeSnapshot);
            createdInvoiceThisAttempt = true;
            if (!invoice?.invoice_id) throw new Error("Zoho did not return an Invoice ID.");
          } else {
            productItem = await resolveSelectedProductItem(order.flavour, order.itemId, true);
            beforeSnapshot = buildStockSnapshot(order.flavour, productItem, order.quantity);
          }
          await saveCheckoutProgress(checkoutAttempt, {
            invoiceId: String(invoice.invoice_id),
            invoiceNumber: invoice.invoice_number || null,
            reference
          });
          await addWebsiteReservation(order, beforeSnapshot, invoice);
          await renewDistributedLock(stockLock);
          const currentInvoiceStatus = String(invoice.status || "").toLowerCase();
          let controlledInvoice = invoice;
          if (currentInvoiceStatus !== "paid") {
            diagnosticStage = "CHECKOUT_INVOICE_CONTROL";
            controlledInvoice = await updateInvoiceControls(invoice.invoice_id, reference, order.courierLocker);
            const controlledStatus = String(controlledInvoice?.status || "").toLowerCase();
            if (!["sent", "overdue", "paid"].includes(controlledStatus)) {
              controlledInvoice = await markInvoiceSent(invoice.invoice_id);
            } else {
              controlledInvoice = await getInvoice(invoice.invoice_id);
            }
          } else {
            controlledInvoice = await getInvoice(invoice.invoice_id);
          }
          await saveCheckoutProgress(checkoutAttempt, {
            invoiceId: String(controlledInvoice.invoice_id),
            invoiceNumber: controlledInvoice.invoice_number || null,
            invoiceStatus: String(controlledInvoice.status || "")
          });
          await renewDistributedLock(stockLock);
          controlledInvoice = assertDirectInvoiceMatches(controlledInvoice, order, customer, reference);
          if (Math.abs(Number(controlledInvoice.total) - Number(order.amount)) > PAYMENT_EPSILON) {
            const e = new Error("Zoho invoice total does not match the server-authoritative checkout total.");
            e.statusCode = 409;
            throw e;
          }
          if (controlledInvoice.allow_partial_payments !== false) {
            const e = new Error("Zoho did not enforce full-payment-only mode.");
            e.statusCode = 409;
            throw e;
          }
          if (!isPaypalConfigured(controlledInvoice)) {
            const e = new Error("PayPal is not configured as an active payment gateway for this invoice.");
            e.statusCode = 409;
            throw e;
          }
          diagnosticStage = "CHECKOUT_PAYMENT_LINK";
          const rawPaymentUrl = controlledInvoice.invoice_url || await generatePaymentLink(controlledInvoice.invoice_id);
          if (!rawPaymentUrl) {
            const e = new Error("Zoho did not provide a payment link.");
            e.statusCode = 409;
            throw e;
          }
          const paymentUrl = validatePaymentUrl(rawPaymentUrl);
          const checkoutToken = signCheckout({
            checkoutId: order.checkoutId,
            invoiceId: String(controlledInvoice.invoice_id),
            invoiceNumber: controlledInvoice.invoice_number || null,
            amount: order.amount,
            itemId: String(order.itemId),
            flavour: order.flavour,
            quantity: order.quantity,
            exp: Date.now() + CHECKOUT_TOKEN_LIFETIME_MS,
            verifyUntil: Date.now() + PAYMENT_VERIFICATION_GRACE_MS
          });
          const responsePayload = {
            success: true,
            pendingPayment: true,
            message: String(controlledInvoice.status || "").toLowerCase() === "paid" ? "Zoho already records this invoice as paid. Verify payment here to confirm the order and unlock the receipt." : "Stock reserved. Full payment is required within 30 minutes. Complete payment through the secure Zoho/PayPal page, then verify payment here.",
            paymentUrl,
            checkoutToken,
            expiresInMinutes: 30,
            order: {
              invoiceNumber: controlledInvoice.invoice_number || null,
              flavour: order.flavour,
              quantity: order.quantity,
              amount: order.amount,
              courierLocker: order.courierLocker
            }
          };
          diagnosticStage = "COMPLETE";
          await saveCheckoutPending(checkoutAttempt, responsePayload);
          cachedAvailabilityUntil = 0;
          return json(200, { ...responsePayload, requestId });
        } catch (error) {
          const transient = error.statusCode === 503 || error.statusCode === 504 || error.name === "AbortError";
          if (!transient) {
            let invoicePaid = false;
            if (invoice?.invoice_id) {
              try {
                const current = await getInvoice(invoice.invoice_id);
                invoicePaid = String(current.status || "").toLowerCase() === "paid" || Math.abs(Number(current.balance || 0)) <= PAYMENT_EPSILON;
              } catch (_) {
              }
              if (!invoicePaid) await voidInvoice(invoice.invoice_id);
            }
            if (!invoicePaid) await releaseWebsiteReservation(order.itemId, order.checkoutId);
          }
          await markCheckoutFailed(checkoutAttempt, error.message);
          cachedAvailabilityUntil = 0;
          if (!transient) {
            try {
              error.freshAvailability = await getProductAvailability(true, false);
            } catch (_) {
            }
          }
          throw error;
        } finally {
          await releaseStockLock(stockLock);
        }
      } catch (error) {
        const statusCode = error.statusCode || (error instanceof TypeError ? 400 : 500);
        const retryHeaders = error.retryAfter ? { "Retry-After": error.retryAfter } : {};
        console.error("Zoho integration request failed", { requestId, statusCode, error: error.name, message: error.message });
        if (error.name === "AbortError") return publicError(504, "Zoho did not respond in time. Please try again.", requestId);
        if (statusCode === 503 && error.code === "STOCK_BUSY") {
          return json(503, {
            success: false,
            code: "STOCK_BUSY",
            message: "Another checkout is currently reserving this flavour. Please try again in a moment.",
            retryAfterSeconds: Number(error.retryAfter || 2),
            requestId
          }, retryHeaders);
        }
        if (statusCode === 503) {
          const raw = String(error?.message || "");
          let diagnosticCode = "ZOHO_TEMPORARY_FAILURE";
          let diagnosticMessage = "A temporary Zoho/Worker failure occurred.";
          if (error.service === "checkout_storage" || /checkout storage|D1|database|storage/i.test(raw)) {
            diagnosticCode = "CHECKOUT_STORAGE_FAILED";
            diagnosticMessage = "Cloudflare D1 checkout storage is temporarily unavailable.";
          } else if (/request queue is temporarily busy/i.test(raw)) {
            diagnosticCode = "ZOHO_REQUEST_QUEUE_BUSY";
            diagnosticMessage = "The Worker Zoho request queue is temporarily busy.";
          } else if (/rate\/concurrency limit reached/i.test(raw)) {
            diagnosticCode = "ZOHO_RATE_LIMITED";
            diagnosticMessage = "Zoho returned a rate or concurrency limit response.";
          } else if (/authentication could not be refreshed/i.test(raw)) {
            diagnosticCode = "ZOHO_AUTH_REFRESH_FAILED";
            diagnosticMessage = "Zoho OAuth refresh failed. Check client ID, client secret, refresh token, and Zoho Accounts data centre.";
          } else if (/Live Zoho stock could not be read/i.test(raw)) {
            diagnosticCode = "ZOHO_STOCK_READ_FAILED";
            diagnosticMessage = "Live Zoho stock could not be read after the availability lookup was attempted.";
          } else if (/Zoho Books API request failed/i.test(raw)) {
            diagnosticCode = "ZOHO_BOOKS_API_5XX";
            diagnosticMessage = "Zoho Books returned a server-side failure during the API request.";
          }
          return json(503, {
            success: false,
            message: error.service === "checkout_storage" ? "Secure checkout storage is temporarily unavailable. Please try again shortly." : "Zoho Books is temporarily busy. Please try again shortly.",
            requestId,
            diagnosticCode,
            diagnosticMessage
          }, retryHeaders);
        }
        if ([402, 409, 410, 401].includes(statusCode)) {
          if (statusCode === 409) {
            let availability = error.freshAvailability || null;
            if (!availability) {
              try {
                availability = await getProductAvailability(true, false);
              } catch (_) {
              }
            }
            if (availability) {
              return json(409, { success: false, message: error.message, requestId, availability, verifiedAt: (/* @__PURE__ */ new Date()).toISOString() });
            }
          }
          return publicError(statusCode, error.message, requestId);
        }
        if (statusCode >= 500) {
          const raw = String(error?.message || "");
          const checkoutDiagnostic = diagnosticStage && String(diagnosticStage).startsWith("CHECKOUT_");
          let diagnosticCode = diagnosticStage && diagnosticStage !== "COMPLETE" ? checkoutDiagnostic ? `${diagnosticStage}_FAILED` : `CONNECTION_TEST_${diagnosticStage}_FAILED` : "INTERNAL_ERROR";
          let diagnosticMessage = diagnosticStage && diagnosticStage !== "COMPLETE" ? checkoutDiagnostic ? `The controlled checkout test failed during stage: ${diagnosticStage}.` : `The protected connection test failed during stage: ${diagnosticStage}.` : "The test deployment hit an internal server error.";
          const missing = raw.match(/^Missing required server environment variable: ([A-Z0-9_]+)$/);
          if (missing) {
            diagnosticCode = "MISSING_ENV";
            diagnosticMessage = `Missing required runtime variable: ${missing[1]}`;
          } else if (/authentication could not be refreshed/i.test(raw)) {
            diagnosticCode = "ZOHO_AUTH_REFRESH_FAILED";
            diagnosticMessage = "Zoho OAuth refresh failed. Check the Zoho client ID, client secret, refresh token, and Accounts URL/data centre.";
          } else if (/Live Zoho stock could not be read/i.test(raw)) {
            diagnosticCode = "ZOHO_STOCK_READ_FAILED";
            diagnosticMessage = "Zoho authentication succeeded far enough to attempt stock lookup, but live stock could not be read.";
          } else if (/Zoho Books API request failed/i.test(raw)) {
            if (!(diagnosticStage && diagnosticStage !== "COMPLETE")) {
              diagnosticCode = "ZOHO_BOOKS_API_FAILED";
              diagnosticMessage = "Zoho Books API rejected or failed the request.";
            }
          } else if (/checkout storage|D1|database|storage/i.test(raw)) {
            diagnosticCode = "CHECKOUT_STORAGE_FAILED";
            diagnosticMessage = "Cloudflare D1 checkout storage failed or is unavailable.";
          }
          return json(statusCode, {
            success: false,
            message: "Unable to process the request.",
            requestId,
            diagnosticCode,
            diagnosticMessage,
            ...error.zohoHttpStatus ? { zohoHttpStatus: error.zohoHttpStatus } : {},
            ...error.zohoApiCode ? { zohoApiCode: error.zohoApiCode } : {},
            ...error.zohoApiMessage ? { zohoApiMessage: error.zohoApiMessage } : {}
          }, retryHeaders);
        }
        return publicError(statusCode, error.message, requestId, retryHeaders);
      }
    }, "handler");
    exports.__test = { buildOwnerTestResetPlan };
    exports.bindCloudflareRuntime = bindCloudflareRuntime;
    exports.getGoogleFacingAvailability = /* @__PURE__ */ __name(async function getGoogleFacingAvailability2(env) {
      bindCloudflareRuntime(env);
      return getProductAvailability(false, false, true);
    }, "getGoogleFacingAvailability");
  }
});

// src/cleanup-expired-checkouts.cjs
var require_cleanup_expired_checkouts = __commonJS({
  "src/cleanup-expired-checkouts.cjs"(exports) {
    "use strict";
    var REQUEST_TIMEOUT_MS = 7e3;
    var BOOKS_API_VERSION = "v3";
    var CHECKOUT_PAYMENT_WINDOW_MS = 30 * 60 * 1e3;
    var PAYMENT_EPSILON = 0.01;
    var CHECKOUT_NAMESPACE = "vestige-checkouts";
    var RESERVATION_NAMESPACE = "vestige-stock-reservations";
    var TERMINAL_CHECKOUT_RETENTION_MS = 30 * 24 * 60 * 60 * 1e3;
    var CONFIRMED_CHECKOUT_MINIMISATION_MS = 90 * 24 * 60 * 60 * 1e3;
    var PROTECTED_FINANCIAL_REFERENCES = /* @__PURE__ */ new Set(["V0001", "V0002", "V0004"]);
    var TERMINAL_STATES = /* @__PURE__ */ new Set(["expired", "cancelled_customer", "cancelled_unpaid", "failed"]);
    var ALLOWED_ACCOUNTS_HOSTS = /* @__PURE__ */ new Set(["accounts.zoho.com", "accounts.zoho.eu", "accounts.zoho.in", "accounts.zoho.com.au", "accounts.zoho.jp", "accounts.zoho.ca", "accounts.zoho.com.cn", "accounts.zoho.sa"]);
    var ALLOWED_API_HOSTS = /* @__PURE__ */ new Set(["www.zohoapis.com", "www.zohoapis.eu", "www.zohoapis.in", "www.zohoapis.com.au", "www.zohoapis.jp", "www.zohoapis.ca", "www.zohoapis.com.cn", "www.zohoapis.sa"]);
    var d1Database = null;
    function bindCloudflareRuntime(e) {
      d1Database = e?.CHECKOUT_DB || null;
      globalThis.__VESTIGE_ENV = e || {};
    }
    __name(bindCloudflareRuntime, "bindCloudflareRuntime");
    function runtimeEnv(name) {
      const e = globalThis.__VESTIGE_ENV || {};
      const v = e[name] ?? (typeof process !== "undefined" && process.env ? process.env[name] : void 0);
      return v;
    }
    __name(runtimeEnv, "runtimeEnv");
    function env(name) {
      const v = runtimeEnv(name);
      if (!v || !String(v).trim()) throw new Error(`Missing ${name}`);
      return String(v).trim();
    }
    __name(env, "env");
    function requireDatabase() {
      if (!d1Database) throw new Error("Cloudflare D1 checkout storage is not bound.");
      return d1Database;
    }
    __name(requireDatabase, "requireDatabase");
    async function timedFetch(url, options = {}) {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), REQUEST_TIMEOUT_MS);
      try {
        return await fetch(url, { ...options, signal: c.signal });
      } finally {
        clearTimeout(t);
      }
    }
    __name(timedFetch, "timedFetch");
    function accountsUrl() {
      const u = new URL(runtimeEnv("ZOHO_ACCOUNTS_URL") || "https://accounts.zoho.com");
      if (u.protocol !== "https:" || !ALLOWED_ACCOUNTS_HOSTS.has(u.hostname)) throw new Error("Unapproved Zoho Accounts host");
      return `${u.protocol}//${u.hostname}`;
    }
    __name(accountsUrl, "accountsUrl");
    async function access() {
      const form = new URLSearchParams({ refresh_token: env("ZOHO_REFRESH_TOKEN"), client_id: env("ZOHO_CLIENT_ID"), client_secret: env("ZOHO_CLIENT_SECRET"), grant_type: "refresh_token" });
      const r = await timedFetch(`${accountsUrl()}/oauth/v2/token`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
      const d = await r.json();
      if (!r.ok || !d.access_token || !d.api_domain) throw new Error("Zoho OAuth failed");
      const api = new URL(d.api_domain);
      if (api.protocol !== "https:" || !ALLOWED_API_HOSTS.has(api.hostname)) throw new Error("Unapproved Zoho API host");
      return { token: d.access_token, api: `${api.protocol}//${api.hostname}` };
    }
    __name(access, "access");
    function query(extra = {}) {
      return new URLSearchParams({ organization_id: env("ZOHO_ORGANIZATION_ID"), ...extra }).toString();
    }
    __name(query, "query");
    async function zoho(auth, path, { method = "GET", body } = {}) {
      const r = await timedFetch(`${auth.api}/books/${BOOKS_API_VERSION}${path}`, { method, headers: { Authorization: `Zoho-oauthtoken ${auth.token}`, Accept: "application/json", ...body === void 0 ? {} : { "Content-Type": "application/json" } }, ...body === void 0 ? {} : { body: JSON.stringify(body) } });
      let d = {};
      try {
        d = await r.json();
      } catch (_) {
      }
      if (!r.ok || d.code !== 0) {
        const e = new Error(`Zoho API failure ${r.status}/${d.code}`);
        e.httpStatus = r.status;
        e.zohoCode = d.code;
        throw e;
      }
      return d;
    }
    __name(zoho, "zoho");
    function webReference(checkoutId) {
      return `WEB-${checkoutId}`.slice(0, 100);
    }
    __name(webReference, "webReference");
    function isVoidedStatus(status) {
      return ["void", "voided", "cancelled", "canceled"].includes(String(status || "").toLowerCase());
    }
    __name(isVoidedStatus, "isVoidedStatus");
    function isPaidInvoice(invoice) {
      const status = String(invoice?.status || "").toLowerCase();
      const balance = Number(invoice?.balance);
      return status === "paid" || Number.isFinite(balance) && Math.abs(balance) <= PAYMENT_EPSILON;
    }
    __name(isPaidInvoice, "isPaidInvoice");
    function hasPaymentEvidence(rows) {
      return (Array.isArray(rows) ? rows : []).some((p) => String(p.payment_id || "").trim() || String(p.online_transaction_id || "").trim() || Number(p.amount || p.amount_applied || 0) > 0);
    }
    __name(hasPaymentEvidence, "hasPaymentEvidence");
    async function listExpiredPendingCheckouts(now) {
      const cutoff = now - CHECKOUT_PAYMENT_WINDOW_MS;
      const result = await requireDatabase().prepare(
        `SELECT key, value_json, etag, updated_at
       FROM kv_store
      WHERE namespace = ?1
        AND json_extract(value_json, '$.state') = 'pending_payment'
        AND updated_at <= ?2
      ORDER BY updated_at ASC
      LIMIT 200`
      ).bind(CHECKOUT_NAMESPACE, cutoff).all();
      return Array.isArray(result?.results) ? result.results : [];
    }
    __name(listExpiredPendingCheckouts, "listExpiredPendingCheckouts");
    async function findReservations(checkoutId) {
      const result = await requireDatabase().prepare(
        `SELECT key, value_json, etag
       FROM kv_store
      WHERE namespace = ?1
        AND value_json LIKE ?2
      LIMIT 100`
      ).bind(RESERVATION_NAMESPACE, `%${String(checkoutId)}%`).all();
      const matches = [];
      for (const row of result?.results || []) {
        let data;
        try {
          data = JSON.parse(row.value_json);
        } catch (_) {
          continue;
        }
        const reservations = Array.isArray(data?.reservations) ? data.reservations : [];
        if (reservations.some((r) => String(r?.checkoutId || "") === String(checkoutId))) matches.push({ row, data });
      }
      return matches;
    }
    __name(findReservations, "findReservations");
    async function releaseReservation(checkoutId) {
      let releasedCount = 0;
      for (let pass = 0; pass < 6; pass += 1) {
        const found = await findReservations(checkoutId);
        if (!found.length) return { released: releasedCount > 0, releasedCount };
        let conflict = false;
        for (const { row, data } of found) {
          const before = Array.isArray(data.reservations) ? data.reservations : [];
          const after = before.filter((r) => String(r?.checkoutId || "") !== String(checkoutId));
          if (after.length === before.length) continue;
          const next = { ...data, reservations: after, updatedAt: Date.now() };
          const etag = crypto.randomUUID();
          const result = await requireDatabase().prepare(
            `UPDATE kv_store
            SET value_json = ?3, etag = ?4, updated_at = ?5
          WHERE namespace = ?1 AND key = ?2 AND etag = ?6`
          ).bind(RESERVATION_NAMESPACE, String(row.key), JSON.stringify(next), etag, Date.now(), String(row.etag)).run();
          if (Number(result?.meta?.changes || 0) > 0) releasedCount += 1;
          else conflict = true;
        }
        if (!conflict) return { released: releasedCount > 0, releasedCount };
      }
      throw new Error("Unable to release all website stock reservations safely after repeated D1 conflicts.");
    }
    __name(releaseReservation, "releaseReservation");
    async function markCheckoutExpired(row, checkoutId, invoice) {
      let current;
      try {
        current = JSON.parse(row.value_json);
      } catch (_) {
        current = {};
      }
      const response = current.response && typeof current.response === "object" ? { ...current.response } : {};
      delete response.paymentUrl;
      delete response.checkoutToken;
      response.success = false;
      response.pendingPayment = false;
      response.message = "This checkout expired before full payment was confirmed. Please start a new checkout.";
      const record = {
        ...current,
        state: "expired",
        response,
        expired: { invoiceId: String(invoice?.invoice_id || current?.progress?.invoiceId || ""), expiredAt: (/* @__PURE__ */ new Date()).toISOString(), reason: "payment_window_elapsed" },
        updatedAt: Date.now(),
        expiresAt: Date.now()
      };
      const result = await requireDatabase().prepare(
        `UPDATE kv_store
        SET value_json = ?3, etag = ?4, updated_at = ?5
      WHERE namespace = ?1 AND key = ?2 AND etag = ?6`
      ).bind(CHECKOUT_NAMESPACE, String(row.key), JSON.stringify(record), crypto.randomUUID(), Date.now(), String(row.etag)).run();
      if (Number(result?.meta?.changes || 0) === 0) throw new Error("Checkout state changed during cleanup; leaving it for the next run.");
    }
    __name(markCheckoutExpired, "markCheckoutExpired");
    async function getInvoice(auth, invoiceId) {
      const data = await zoho(auth, `/invoices/${encodeURIComponent(invoiceId)}?${query()}`);
      return data.invoice || {};
    }
    __name(getInvoice, "getInvoice");
    async function getPayments(auth, invoiceId) {
      const data = await zoho(auth, `/invoices/${encodeURIComponent(invoiceId)}/payments?${query()}`);
      return Array.isArray(data.payments) ? data.payments : [];
    }
    __name(getPayments, "getPayments");
    function paymentReferenceFromCheckout(checkout) {
      return String(checkout?.progress?.paymentReference || checkout?.response?.paymentReference || "").trim().toUpperCase();
    }
    __name(paymentReferenceFromCheckout, "paymentReferenceFromCheckout");
    function isProtectedFinancialCheckout(checkout) {
      return PROTECTED_FINANCIAL_REFERENCES.has(paymentReferenceFromCheckout(checkout));
    }
    __name(isProtectedFinancialCheckout, "isProtectedFinancialCheckout");
    function minimisedConfirmedCheckout(checkout, now) {
      const progress = checkout?.progress && typeof checkout.progress === "object" ? checkout.progress : {};
      const verified = checkout?.verified && typeof checkout.verified === "object" ? checkout.verified : {};
      return {
        state: "confirmed",
        progress: {
          paymentMode: progress.paymentMode || null,
          paymentReference: progress.paymentReference || null,
          items: Array.isArray(progress.items) ? progress.items.map((line) => ({
            flavour: String(line?.flavour || "").slice(0, 80),
            itemId: String(line?.itemId || "").slice(0, 80),
            quantity: Number(line?.quantity || 0)
          })) : [],
          totalQuantity: Number(progress.totalQuantity || 0),
          amount: Number(progress.amount || 0),
          deliveryMethod: progress.deliveryMethod || null,
          deliveryCharge: Number(progress.deliveryCharge || 0),
          bankInvoiceId: progress.bankInvoiceId || progress.invoiceId || null,
          bankPaymentId: progress.bankPaymentId || progress.paymentId || null,
          bankPaymentDate: progress.bankPaymentDate || null,
          bankConfirmedAmount: Number(progress.bankConfirmedAmount || 0)
        },
        verified: {
          paymentId: verified.paymentId || null,
          invoiceId: verified.invoiceId || null,
          amount: Number(verified.amount || 0),
          paymentMode: verified.paymentMode || null,
          confirmationSource: verified.confirmationSource || null,
          confirmedAt: verified.confirmedAt || null
        },
        retention: { personalDataRemovedAt: new Date(now).toISOString(), policy: "confirmed_checkout_90_days" },
        updatedAt: now,
        expiresAt: now
      };
    }
    __name(minimisedConfirmedCheckout, "minimisedConfirmedCheckout");
    async function enforceCheckoutRetention(now) {
      const cutoff = now - TERMINAL_CHECKOUT_RETENTION_MS;
      const result = await requireDatabase().prepare(
        `SELECT key, value_json, etag, updated_at
       FROM kv_store
      WHERE namespace = ?1
        AND updated_at <= ?2
        AND json_extract(value_json, '$.state') IN ('confirmed','expired','cancelled_customer','cancelled_unpaid','failed')
      ORDER BY updated_at ASC
      LIMIT 200`
      ).bind(CHECKOUT_NAMESPACE, cutoff).all();
      const stats = { retentionScanned: 0, terminalDeleted: 0, confirmedMinimised: 0, protectedFinancialRecords: 0, retentionConflicts: 0 };
      for (const row of result?.results || []) {
        stats.retentionScanned++;
        let checkout;
        try {
          checkout = JSON.parse(row.value_json);
        } catch (_) {
          continue;
        }
        if (isProtectedFinancialCheckout(checkout)) {
          stats.protectedFinancialRecords++;
          continue;
        }
        const age = now - Number(row.updated_at || 0);
        const state = String(checkout?.state || "");
        if (TERMINAL_STATES.has(state) && age >= TERMINAL_CHECKOUT_RETENTION_MS) {
          const deleted = await requireDatabase().prepare(
            `DELETE FROM kv_store WHERE namespace = ?1 AND key = ?2 AND etag = ?3`
          ).bind(CHECKOUT_NAMESPACE, String(row.key), String(row.etag)).run();
          if (Number(deleted?.meta?.changes || 0) > 0) stats.terminalDeleted++;
          else stats.retentionConflicts++;
          continue;
        }
        if (state === "confirmed" && age >= CONFIRMED_CHECKOUT_MINIMISATION_MS && !checkout?.retention?.personalDataRemovedAt) {
          const minimised = minimisedConfirmedCheckout(checkout, now);
          const updated = await requireDatabase().prepare(
            `UPDATE kv_store SET value_json = ?3, etag = ?4, updated_at = ?5
          WHERE namespace = ?1 AND key = ?2 AND etag = ?6`
          ).bind(CHECKOUT_NAMESPACE, String(row.key), JSON.stringify(minimised), crypto.randomUUID(), now, String(row.etag)).run();
          if (Number(updated?.meta?.changes || 0) > 0) stats.confirmedMinimised++;
          else stats.retentionConflicts++;
        }
      }
      return stats;
    }
    __name(enforceCheckoutRetention, "enforceCheckoutRetention");
    exports.handler = async function() {
      const stats = { scanned: 0, voided: 0, alreadyVoided: 0, skippedPaid: 0, manualReview: 0, bankExpired: 0, reservationsReleased: 0, expiredMarked: 0, paymentReviewHeld: 0 };
      try {
        Object.assign(stats, await enforceCheckoutRetention(Date.now()));
        const auth = await access();
        const rows = await listExpiredPendingCheckouts(Date.now());
        stats.scanned = rows.length;
        for (const row of rows) {
          const checkoutId = String(row.key || "").replace(/^checkout-/, "");
          if (!checkoutId) {
            stats.manualReview++;
            continue;
          }
          let checkout;
          try {
            checkout = JSON.parse(row.value_json);
          } catch (_) {
            stats.manualReview++;
            console.warn("Invalid checkout JSON; manual review required", { checkoutId });
            continue;
          }
          const paymentMode = String(checkout?.progress?.paymentMode || "").trim();
          const paymentExpiresAt = Number(checkout?.progress?.paymentExpiresAt || 0);
          const paymentClaimedAt = Number(checkout?.progress?.paymentClaimedAt || 0);
          const invoiceId = String(checkout?.progress?.invoiceId || "").trim();
          if (paymentMode === "bank_transfer" && !invoiceId) {
            if (paymentClaimedAt > 0) {
              stats.paymentReviewHeld++;
              continue;
            }
            if (paymentExpiresAt && Date.now() < paymentExpiresAt) continue;
            try {
              const rel2 = await releaseReservation(checkoutId);
              if (rel2.released) stats.reservationsReleased++;
              await markCheckoutExpired(row, checkoutId, null);
              stats.bankExpired++;
              stats.expiredMarked++;
            } catch (error) {
              stats.manualReview++;
              console.warn("Bank checkout cleanup needs retry", { checkoutId, message: error.message });
            }
            continue;
          }
          if (!invoiceId) {
            stats.manualReview++;
            console.warn("Expired checkout has no invoice ID and is not a recognised bank-payment checkout; manual review required", { checkoutId });
            continue;
          }
          let invoice;
          try {
            invoice = await getInvoice(auth, invoiceId);
          } catch (error) {
            stats.manualReview++;
            console.warn("Unable to read expired checkout invoice; leaving untouched", { checkoutId, invoiceId });
            continue;
          }
          if (String(invoice.reference_number || "") !== webReference(checkoutId)) {
            stats.manualReview++;
            console.warn("Invoice reference does not match checkout; refusing automatic cleanup", { checkoutId, invoiceId });
            continue;
          }
          if (isPaidInvoice(invoice)) {
            stats.skippedPaid++;
            console.log("Expired timer reached but invoice is paid; no void performed", { checkoutId, invoiceId });
            continue;
          }
          if (isVoidedStatus(invoice.status)) {
            stats.alreadyVoided++;
            try {
              const rel2 = await releaseReservation(checkoutId);
              if (rel2.released) stats.reservationsReleased++;
              await markCheckoutExpired(row, checkoutId, invoice);
              stats.expiredMarked++;
            } catch (error) {
              stats.manualReview++;
              console.warn("Invoice already void but D1 cleanup needs retry", { checkoutId, invoiceId, message: error.message });
            }
            continue;
          }
          let paymentRows;
          try {
            paymentRows = await getPayments(auth, invoiceId);
          } catch (error) {
            stats.manualReview++;
            console.warn("Unable to verify payment state; refusing automatic void", { checkoutId, invoiceId });
            continue;
          }
          if (String(invoice.status || "").toLowerCase() === "partially_paid" || hasPaymentEvidence(paymentRows)) {
            stats.manualReview++;
            console.warn("Expired invoice has payment evidence; manual review required", { checkoutId, invoiceId });
            continue;
          }
          let finalInvoice;
          try {
            finalInvoice = await getInvoice(auth, invoiceId);
          } catch (error) {
            stats.manualReview++;
            continue;
          }
          if (isPaidInvoice(finalInvoice)) {
            stats.skippedPaid++;
            continue;
          }
          if (isVoidedStatus(finalInvoice.status)) {
            stats.alreadyVoided++;
          } else {
            let finalPayments;
            try {
              finalPayments = await getPayments(auth, invoiceId);
            } catch (error) {
              stats.manualReview++;
              continue;
            }
            if (String(finalInvoice.status || "").toLowerCase() === "partially_paid" || hasPaymentEvidence(finalPayments)) {
              stats.manualReview++;
              continue;
            }
            await zoho(auth, `/invoices/${encodeURIComponent(invoiceId)}/status/void?${query()}`, { method: "POST" });
            stats.voided++;
          }
          const rel = await releaseReservation(checkoutId);
          if (rel.released) stats.reservationsReleased++;
          await markCheckoutExpired(row, checkoutId, finalInvoice);
          stats.expiredMarked++;
        }
        console.log("Vestige mixed invoice/bank expired checkout cleanup complete", stats);
        return { statusCode: 200, body: JSON.stringify({ success: true, ...stats }) };
      } catch (error) {
        console.error("Expired checkout cleanup failed", { message: error.message });
        return { statusCode: 500, body: JSON.stringify({ success: false }) };
      }
    };
    exports.bindCloudflareRuntime = bindCloudflareRuntime;
    exports.__retentionTest = { paymentReferenceFromCheckout, isProtectedFinancialCheckout, minimisedConfirmedCheckout };
  }
});

// src/worker.js
var import_zoho_integration = __toESM(require_zoho_integration());
var import_cleanup_expired_checkouts = __toESM(require_cleanup_expired_checkouts());
var { handler: zohoHandler, bindCloudflareRuntime: bindZohoRuntime, getGoogleFacingAvailability } = import_zoho_integration.default;
var { handler: cleanupHandler, bindCloudflareRuntime: bindCleanupRuntime } = import_cleanup_expired_checkouts.default;
var SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self'; img-src 'self' data: https://*.google-analytics.com https://www.googletagmanager.com; media-src 'self'; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests"
};
function headersObject(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) {
    out[key] = value;
  }
  return out;
}
__name(headersObject, "headersObject");
async function toNetlifyEvent(request) {
  const url = new URL(request.url);
  return {
    path: url.pathname,
    rawUrl: request.url,
    httpMethod: request.method,
    headers: headersObject(request.headers),
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body: ["GET", "HEAD"].includes(request.method) ? null : await request.text(),
    isBase64Encoded: false
  };
}
__name(toNetlifyEvent, "toNetlifyEvent");
function fromLambdaResult(result) {
  const headers = new Headers(result?.headers || {});
  return new Response(result?.body ?? "", {
    status: Number(result?.statusCode || 200),
    headers
  });
}
__name(fromLambdaResult, "fromLambdaResult");
async function apiResponse(request, env) {
  bindZohoRuntime(env);
  const event = await toNetlifyEvent(request);
  return fromLambdaResult(
    await zohoHandler(event)
  );
}
__name(apiResponse, "apiResponse");
function cachePolicyForPath(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path === "/api/zoho" || path === "/owner" || path === "/owner.html" || path === "/owner.js" || path === "/owner.css" || path === "/order-status" || path === "/order-status.html") {
    return "no-store";
  }
  if (path === "/robots.txt" || path === "/sitemap.xml") {
    return "public, max-age=300, s-maxage=3600, must-revalidate";
  }
  if (/^\/flavours\/(blueberry-mint|miami-mint|blue-razz-ice|strawberry-kiwi-ice|watermelon-ice)(?:\.html)?$/.test(path)) {
    return "public, max-age=30, s-maxage=60, must-revalidate";
  }
  if (/^\/elfa-pro\/(peach-ice|spearmint|miami-mint|grape|watermelon)(?:\.html)?$/.test(path)) {
    return "public, max-age=300, s-maxage=1800, must-revalidate";
  }
  if (path === "/" || path.endsWith(".html") || !path.includes(".") && path !== "") {
    return "public, max-age=300, s-maxage=1800, must-revalidate";
  }
  if (path.endsWith(".css") || path.endsWith(".js")) {
    return "public, max-age=3600, s-maxage=86400, must-revalidate";
  }
  if (/\.(png|jpe?g|webp|gif|svg|ico|mp4|webm|woff2?|ttf|otf)$/.test(path)) {
    return "public, max-age=86400, s-maxage=604800";
  }
  return "public, max-age=300, s-maxage=3600, must-revalidate";
}
__name(cachePolicyForPath, "cachePolicyForPath");
function withSecurityHeaders(response, pathname = "") {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  headers.set("Cache-Control", cachePolicyForPath(pathname));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withSecurityHeaders, "withSecurityHeaders");
function canonicalRedirectResponse(request) {
  const url = new URL(request.url);
  let changed = false;
  if (url.hostname.toLowerCase() === "www.vestigeltd.co.za") {
    url.hostname = "vestigeltd.co.za";
    changed = true;
  }
  if (url.pathname === "/index.html") {
    url.pathname = "/";
    changed = true;
  } else if (url.pathname === "/contact.html") {
    url.pathname = "/contact";
    changed = true;
  } else if (url.pathname === "/privacy-policy.html") {
    url.pathname = "/privacy-policy";
    changed = true;
  } else if (url.pathname === "/terms-and-conditions.html") {
    url.pathname = "/terms-and-conditions";
    changed = true;
  } else if (url.pathname === "/returns-refunds.html") {
    url.pathname = "/returns-refunds";
  } else if (url.pathname === "/vape-durbanville.html") {
    url.pathname = "/vape-durbanville";
    changed = true;
  } else if (/^\/flavours\/(blueberry-mint|miami-mint|blue-razz-ice|strawberry-kiwi-ice|watermelon-ice)\.html$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\.html$/, "");
    changed = true;
  } else if (["/bc10000", "/elfbar", "/elfa-master", "/elfa-pro"].includes(url.pathname)) {
    url.pathname = url.pathname + "/";
    changed = true;
  } else if (/^\/elfa-pro\/(peach-ice|spearmint|miami-mint|grape|watermelon)\.html$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\.html$/, "");
    changed = true;
  } else if (/^\/elfa-pro\/(peach-ice|spearmint|miami-mint|grape|watermelon)\/$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/$/, "");
    changed = true;
  }
  if (!changed) return null;
  return new Response(null, {
    status: 301,
    headers: {
      Location: url.toString(),
      "Cache-Control": "public, max-age=3600, s-maxage=86400"
    }
  });
}
__name(canonicalRedirectResponse, "canonicalRedirectResponse");
var VESTIGE_ANALYTICS_NAMESPACE = "vestige-analytics";
var VESTIGE_ANALYTICS_EVENTS = /* @__PURE__ */ new Set([
  "page_view",
  "shop_view",
  "product_selected",
  "basket_created",
  "product_selection_completed",
  "checkout_started",
  "payment_claimed",
  "payment_confirmed"
]);
function analyticsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
__name(analyticsJson, "analyticsJson");
function cleanAnalyticsText(v, max = 80) {
  return String(v == null ? "" : v).trim().slice(0, max);
}
__name(cleanAnalyticsText, "cleanAnalyticsText");
function cleanAnalyticsNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
__name(cleanAnalyticsNumber, "cleanAnalyticsNumber");
async function analyticsWrite(env, payload) {
  if (!env.CHECKOUT_DB) throw new Error("Analytics database unavailable.");
  const event = cleanAnalyticsText(payload && payload.event, 40);
  if (!VESTIGE_ANALYTICS_EVENTS.has(event)) return analyticsJson({ success: false, message: "Unsupported event." }, 400);
  const sessionId = cleanAnalyticsText(payload && payload.sessionId, 64);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(sessionId)) return analyticsJson({ success: false, message: "Invalid analytics session." }, 400);
  const now = Date.now();
  const id = now.toString(36) + "-" + crypto.randomUUID();
  const record = {
    event,
    sessionId,
    at: now,
    path: cleanAnalyticsText(payload && payload.path, 160),
    flavour: cleanAnalyticsText(payload && payload.flavour, 60),
    quantity: cleanAnalyticsNumber(payload && payload.quantity),
    basketItems: cleanAnalyticsNumber(payload && payload.basketItems),
    amount: cleanAnalyticsNumber(payload && payload.amount)
  };
  const valueJson = JSON.stringify(record);
  await env.CHECKOUT_DB.prepare(
    "INSERT INTO kv_store (namespace,key,value_json,etag,updated_at) VALUES (?1,?2,?3,?4,?5)"
  ).bind(VESTIGE_ANALYTICS_NAMESPACE, id, valueJson, crypto.randomUUID(), now).run();
  return analyticsJson({ success: true });
}
__name(analyticsWrite, "analyticsWrite");
async function analyticsSummary(env, days = 30) {
  if (!env.CHECKOUT_DB) throw new Error("Analytics database unavailable.");
  const safeDays = Math.min(365, Math.max(1, Number(days) || 30));
  const cutoff = Date.now() - safeDays * 864e5;
  const result = await env.CHECKOUT_DB.prepare(
    "SELECT value_json FROM kv_store WHERE namespace=?1 AND updated_at>=?2 ORDER BY updated_at DESC LIMIT 10000"
  ).bind(VESTIGE_ANALYTICS_NAMESPACE, cutoff).all();
  const rows = Array.isArray(result && result.results) ? result.results : [];
  const counts = {};
  const sessions = /* @__PURE__ */ new Set();
  let confirmedRevenue = 0;
  let confirmedOrders = 0;
  const flavour = {};
  for (const row of rows) {
    let r;
    try {
      r = JSON.parse(row.value_json || "{}");
    } catch (_) {
      continue;
    }
    if (!VESTIGE_ANALYTICS_EVENTS.has(r.event)) continue;
    counts[r.event] = (counts[r.event] || 0) + 1;
    if (r.sessionId) sessions.add(r.sessionId);
    if (r.event === "payment_confirmed") {
      confirmedOrders++;
      if (Number.isFinite(Number(r.amount))) confirmedRevenue += Number(r.amount);
    }
    if (r.event === "product_selected" && r.flavour) {
      flavour[r.flavour] = (flavour[r.flavour] || 0) + 1;
    }
  }
  const starts = counts.checkout_started || 0;
  const claims = counts.payment_claimed || 0;
  const confirmed = counts.payment_confirmed || 0;
  const baskets = counts.basket_created || 0;
  const conversion = starts ? Math.round(confirmed / starts * 1e3) / 10 : 0;
  const claimRate = starts ? Math.round(claims / starts * 1e3) / 10 : 0;
  return {
    success: true,
    days: safeDays,
    events: counts,
    uniqueSessions: sessions.size,
    checkoutStarts: starts,
    baskets,
    paymentClaims: claims,
    confirmedOrders: confirmed,
    confirmedRevenue: Math.round(confirmedRevenue * 100) / 100,
    averageOrderValue: confirmedOrders ? Math.round(confirmedRevenue / confirmedOrders * 100) / 100 : 0,
    checkoutConversionPercent: conversion,
    paymentClaimPercent: claimRate,
    flavourSelections: Object.entries(flavour).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
  };
}
__name(analyticsSummary, "analyticsSummary");
async function handleVestigeAnalytics(request, env) {
  if (request.method !== "POST") return analyticsJson({ success: false, message: "Method not allowed." }, 405);
  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return analyticsJson({ success: false, message: "Invalid JSON." }, 400);
  }
  if (body && body.action === "admin_summary") {
    const authHeaders = new Headers(request.headers);
    authHeaders.set("Content-Type", "application/json");
    const authRequest = new Request(
      new URL("/api/zoho", request.url).toString(),
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "admin_bank_confirmation_health" })
      }
    );
    const authResponse = await apiResponse(authRequest, env);
    if (!authResponse.ok) {
      return analyticsJson({ success: false, message: "Unauthorized." }, 401);
    }
    return analyticsJson(await analyticsSummary(env, body.days));
  }
  return analyticsWrite(env, body);
}
__name(handleVestigeAnalytics, "handleVestigeAnalytics");
var FLAVOUR_BY_SLUG = Object.freeze({
  "blueberry-mint": "Blueberry Mint",
  "miami-mint": "Miami Mint",
  "blue-razz-ice": "Blue Razz Ice",
  "strawberry-kiwi-ice": "Strawberry Kiwi Ice",
  "watermelon-ice": "Watermelon Ice"
});
function availabilityUrl(stock) {
  return Number(stock) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
}
__name(availabilityUrl, "availabilityUrl");
var VESTIGE_SHIPPING_DETAILS = Object.freeze({
  "@type": "OfferShippingDetails",
  shippingRate: { "@type": "MonetaryAmount", value: "60.00", currency: "ZAR" },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "ZA" },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" }
  }
});
var VESTIGE_RETURN_POLICY = Object.freeze({
  "@type": "MerchantReturnPolicy",
  applicableCountry: "ZA",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 7,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
  itemCondition: "https://schema.org/NewCondition"
});
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
__name(cloneJson, "cloneJson");
function enrichOfferForGoogle(offer, stock) {
  offer.availability = availabilityUrl(stock);
  offer.itemCondition = offer.itemCondition || "https://schema.org/NewCondition";
  offer.seller = offer.seller || { "@type": "Organization", name: "Vestige Ltd" };
  offer.shippingDetails = cloneJson(VESTIGE_SHIPPING_DETAILS);
  offer.hasMerchantReturnPolicy = cloneJson(VESTIGE_RETURN_POLICY);
}
__name(enrichOfferForGoogle, "enrichOfferForGoogle");
function enrichFirstProductJsonLd(html, stock) {
  const marker = '<script type="application/ld+json">';
  let cursor = 0;
  while (true) {
    const start = html.indexOf(marker, cursor);
    if (start < 0) return null;
    const jsonStart = start + marker.length;
    const end = html.indexOf("<\/script>", jsonStart);
    if (end < 0) return null;
    let data;
    try {
      data = JSON.parse(html.slice(jsonStart, end));
    } catch (_) {
      cursor = end + 9;
      continue;
    }
    let product = null;
    if (data?.["@type"] === "Product") product = data;
    else if (Array.isArray(data?.["@graph"])) product = data["@graph"].find((node) => node?.["@type"] === "Product") || null;
    if (!product || !product.offers || typeof product.offers !== "object") {
      cursor = end + 9;
      continue;
    }
    enrichOfferForGoogle(product.offers, stock);
    return html.slice(0, jsonStart) + JSON.stringify(data) + html.slice(end);
  }
}
__name(enrichFirstProductJsonLd, "enrichFirstProductJsonLd");
async function injectGoogleAvailability(request, env, response, pathname) {
  if (!getGoogleFacingAvailability || !response.ok || request.method !== "GET") return response;
  const flavourMatch = pathname.match(/^\/flavours\/([^/]+)$/);
  const isHomepage = pathname === "/";
  if (!flavourMatch && !isHomepage) return response;
  try {
    const availability = await getGoogleFacingAvailability(env);
    let stock = 0;
    if (flavourMatch) {
      const flavour = FLAVOUR_BY_SLUG[flavourMatch[1]];
      if (!flavour || !availability?.[flavour]) return response;
      stock = Number(availability[flavour].stock || 0);
    } else {
      stock = Object.values(availability || {}).reduce((sum, state) => sum + Math.max(0, Number(state?.stock || 0)), 0);
    }
    const html = await response.text();
    const updated = enrichFirstProductJsonLd(html, stock);
    if (!updated) return response;
    const headers = new Headers(response.headers);
    headers.delete("Content-Length");
    headers.set("Content-Type", "text/html; charset=UTF-8");
    headers.set("X-Vestige-Availability", stock > 0 ? "in-stock" : "out-of-stock");
    headers.set("X-Vestige-Merchant-Data", "v35.26.7");
    return new Response(updated, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    return response;
  }
}
__name(injectGoogleAvailability, "injectGoogleAvailability");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if ((request.method === "GET" || request.method === "HEAD") && /^\/elfa-pro\/(peach-ice|spearmint|miami-mint|grape|watermelon)$/.test(url.pathname)) {
      const rewritten = new URL(request.url);
      rewritten.pathname = url.pathname + ".html";
      const assetRequest = new Request(rewritten.toString(), {
        method: request.method,
        headers: request.headers
      });
      const assetResponse = await env.ASSETS.fetch(assetRequest);
      if (assetResponse.status !== 404) {
        return withSecurityHeaders(assetResponse, url.pathname);
      }
    }
    if ((request.method === "GET" || request.method === "HEAD") && /^\/flavours\/(blueberry-mint|miami-mint|blue-razz-ice|strawberry-kiwi-ice|watermelon-ice)$/.test(url.pathname)) {
      const rewritten = new URL(request.url);
      rewritten.pathname = url.pathname + ".html";
      const assetRequest = new Request(rewritten.toString(), {
        method: request.method,
        headers: request.headers
      });
      const assetResponse = await env.ASSETS.fetch(assetRequest);
      if (assetResponse.status !== 404) {
        const enriched = await injectGoogleAvailability(request, env, assetResponse, url.pathname);
        return withSecurityHeaders(enriched, url.pathname);
      }
    }
    if (request.method === "GET" || request.method === "HEAD") {
      const publicPageAssets = {
        "/contact": "/contact.html",
        "/privacy-policy": "/privacy-policy.html",
        "/terms-and-conditions": "/terms-and-conditions.html",
        "/returns-refunds": "/returns-refunds.html",
        "/vape-durbanville": "/vape-durbanville.html"
      };
      const assetPath = publicPageAssets[url.pathname];
      if (assetPath) {
        const rewritten = new URL(request.url);
        rewritten.pathname = assetPath;
        const assetRequest = new Request(rewritten.toString(), {
          method: request.method,
          headers: request.headers
        });
        const assetResponse = await env.ASSETS.fetch(assetRequest);
        if (assetResponse.status !== 404) {
          return withSecurityHeaders(assetResponse, url.pathname);
        }
      }
    }
    const canonicalRedirect = canonicalRedirectResponse(request);
    if (canonicalRedirect) {
      return withSecurityHeaders(canonicalRedirect, url.pathname);
    }
    if (url.pathname === "/api/analytics") {
      return withSecurityHeaders(await handleVestigeAnalytics(request, env), url.pathname);
    }
    if (url.pathname === "/api/zoho" || url.pathname === "/api/analytics") {
      return withSecurityHeaders(
        await apiResponse(request, env),
        url.pathname
      );
    }
    if (!env.ASSETS) {
      return new Response(
        "Static asset binding is missing.",
        {
          status: 503
        }
      );
    }
    const publicAssetResponse = await env.ASSETS.fetch(request);
    const merchantEnriched = await injectGoogleAvailability(request, env, publicAssetResponse, url.pathname);
    return withSecurityHeaders(merchantEnriched, url.pathname);
  },
  async scheduled(_controller, env, ctx) {
    bindCleanupRuntime(env);
    ctx.waitUntil(
      cleanupHandler()
    );
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
