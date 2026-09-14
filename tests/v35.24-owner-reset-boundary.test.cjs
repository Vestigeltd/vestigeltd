'use strict';
const assert = require('node:assert/strict');
const worker = require('../src/zoho-integration.cjs');

function stored(namespace, key, value, etag = `${namespace}-${key}`) {
  return { namespace, key, value_json: JSON.stringify(value), etag, updated_at: 1 };
}

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async all() {
    if (/SELECT namespace,key,value_json,etag,updated_at FROM kv_store WHERE namespace IN/.test(this.sql)) {
      return { results: this.db.rows.filter(row => this.args.includes(row.namespace)).map(row => ({ ...row })) };
    }
    throw new Error(`Unsupported all(): ${this.sql}`);
  }
}

class FakeD1 {
  constructor(rows) { this.rows = rows.map(row => ({ ...row })); }
  prepare(sql) { return new FakeStatement(this, sql); }
  async batch(statements) {
    return statements.map(statement => {
      const sql = statement.sql;
      const args = statement.args;
      let changes = 0;
      if (sql.startsWith('DELETE FROM kv_store')) {
        const before = this.rows.length;
        this.rows = this.rows.filter(row => !(row.namespace === args[0] && row.key === args[1] && row.etag === args[2]));
        changes = before - this.rows.length;
      } else if (sql.startsWith('UPDATE kv_store SET value_json')) {
        const row = this.rows.find(item => item.namespace === args[0] && item.key === args[1] && item.etag === args[5]);
        if (row) {
          row.value_json = args[2];
          row.etag = args[3];
          row.updated_at = args[4];
          changes = 1;
        }
      } else if (sql.startsWith('INSERT INTO kv_store')) {
        this.rows.push({ namespace: args[0], key: args[1], value_json: args[2], etag: args[3], updated_at: args[4] });
        changes = 1;
      } else {
        throw new Error(`Unsupported batch statement: ${sql}`);
      }
      return { meta: { changes } };
    });
  }
}

const db = new FakeD1([
  stored('vestige-checkouts', 'checkout-real-1', { state: 'confirmed', progress: { paymentReference: 'V0001', bankInvoiceId: 'inv-1' } }),
  stored('vestige-checkouts', 'checkout-test-2', { state: 'expired', progress: { paymentReference: 'V0002' } }),
  stored('vestige-checkouts', 'checkout-test-3', { state: 'cancelled_customer', progress: { paymentReference: 'V0003' } }),
  stored('vestige-checkouts', 'checkout-real-4', { state: 'confirmed', progress: { paymentReference: 'V0004', bankPaymentId: 'pay-4' } }),
  stored('vestige-checkouts', 'checkout-test-5', { state: 'pending_payment', progress: { paymentReference: 'V0005' } }),
  stored('vestige-checkouts', 'checkout-test-6', { state: 'expired', progress: { paymentReference: 'V0006' } }),
  stored('vestige-checkouts', 'checkout-real-7', { state: 'confirmed', progress: { paymentReference: 'V0007', bankInvoiceId: 'inv-7' } }),
  stored('vestige-checkouts', 'checkout-test-8', { state: 'pending_payment', progress: { paymentReference: 'V0008' } }),
  stored('vestige-checkouts', 'checkout-test-9', { state: 'cancelled_customer', progress: { paymentReference: 'V0009' } }),
  stored('vestige-order-sequence', 'bank-order', { value: 9, updatedAt: 1 }),
  stored('vestige-bank-payment-reference-index', 'V0009', { checkoutId: 'test-9', paymentReference: 'V0009' }),
  stored('vestige-stock-reservations', 'item-1', { reservations: [{ checkoutId: 'real-4', quantity: 1 }, { checkoutId: 'real-7', quantity: 1 }, { checkoutId: 'test-9', quantity: 1 }], updatedAt: 1 })
]);

const adminKey = '0123456789abcdef0123456789abcdef';
worker.bindCloudflareRuntime({
  CHECKOUT_DB: db,
  ZOHO_CLIENT_ID: 'test-client',
  ZOHO_CLIENT_SECRET: 'test-secret',
  ZOHO_REFRESH_TOKEN: 'test-refresh',
  ZOHO_ORGANIZATION_ID: 'test-org',
  VESTIGE_PAYMENT_ADMIN_KEY: adminKey,
  ALLOWED_ORIGIN: 'https://vestigeltd.co.za'
});

function event(action, extra = {}, key = adminKey) {
  return {
    path: '/api/zoho',
    httpMethod: 'POST',
    headers: {
      origin: 'https://vestigeltd.co.za',
      'content-type': 'application/json',
      'x-vestige-payment-admin-key': key
    },
    body: JSON.stringify({ action, ...extra })
  };
}

(async () => {
  const unauthorized = await worker.handler(event('admin_preview_test_order_reset', {}, 'wrong-key'));
  assert.equal(unauthorized.statusCode, 401);

  const previewResponse = await worker.handler(event('admin_preview_test_order_reset'));
  assert.equal(previewResponse.statusCode, 200, previewResponse.body);
  const preview = JSON.parse(previewResponse.body).preview;
  assert.equal(preview.canApply, true);
  assert.deepEqual(preview.testReferences, ['V0002', 'V0003', 'V0005', 'V0006', 'V0008', 'V0009']);
  assert.deepEqual(preview.testOrders.map(order => order.paymentReference), ['V0002', 'V0003', 'V0005', 'V0006', 'V0008', 'V0009']);
  assert.deepEqual(preview.protectedReferences, ['V0001', 'V0004', 'V0007']);
  assert.equal(preview.nextReference, 'V0008');
  assert.equal(preview.confirmationRequired, 'RESET TO V0008');

  const wrongPhrase = await worker.handler(event('admin_apply_test_order_reset', {
    confirmation: 'RESET TO V0005',
    previewFingerprint: preview.previewFingerprint
  }));
  assert.equal(wrongPhrase.statusCode, 409);
  assert(db.rows.some(row => row.namespace === 'vestige-checkouts' && row.key === 'checkout-test-5'));

  const freshPreviewResponse = await worker.handler(event('admin_preview_test_order_reset'));
  const freshPreview = JSON.parse(freshPreviewResponse.body).preview;
  const appliedResponse = await worker.handler(event('admin_apply_test_order_reset', {
    confirmation: 'RESET TO V0008',
    previewFingerprint: freshPreview.previewFingerprint
  }));
  assert.equal(appliedResponse.statusCode, 200, appliedResponse.body);
  const applied = JSON.parse(appliedResponse.body);
  assert.equal(applied.nextReference, 'V0008');
  assert.equal(applied.zohoBooksChanged, false);
  assert.deepEqual(applied.protectedReferences, ['V0001', 'V0004', 'V0007']);
  assert.deepEqual(applied.removedTestReferences, ['V0002', 'V0003', 'V0005', 'V0006', 'V0008', 'V0009']);

  const remainingRefs = db.rows
    .filter(row => row.namespace === 'vestige-checkouts')
    .map(row => JSON.parse(row.value_json).progress.paymentReference)
    .sort();
  assert.deepEqual(remainingRefs, ['V0001', 'V0004', 'V0007']);
  const sequence = db.rows.find(row => row.namespace === 'vestige-order-sequence' && row.key === 'bank-order');
  assert.equal(JSON.parse(sequence.value_json).value, 7);
  assert(db.rows.some(row => row.namespace === 'vestige-owner-audit' && JSON.parse(row.value_json).action === 'admin_test_order_reset'));
  assert.deepEqual(JSON.parse(db.rows.find(row => row.namespace === 'vestige-stock-reservations').value_json).reservations, [{ checkoutId: 'real-4', quantity: 1 }, { checkoutId: 'real-7', quantity: 1 }]);

  console.log('V35.24.1 dynamic protected owner-reset API boundary checks passed.');
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
