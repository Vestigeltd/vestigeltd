'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const paymentCss = fs.readFileSync(path.join(root, 'public', 'payment-visibility.css'), 'utf8');
const publicScript = fs.readFileSync(path.join(root, 'public', 'script.js'), 'utf8');
const ownerHtml = fs.readFileSync(path.join(root, 'public', 'owner.html'), 'utf8');
const ownerScript = fs.readFileSync(path.join(root, 'public', 'owner.js'), 'utf8');
const integration = require('../src/zoho-integration.cjs');
const reset = integration.__test;

assert.match(paymentCss, /html\.vestige-payment-open \.site-header \{[\s\S]*?background: #06101d !important;/);
assert.match(paymentCss, /html\.vestige-payment-open \.site-header \{[\s\S]*?height: 86px;[\s\S]*?border-bottom: 4px solid #06101d;/);
assert.match(paymentCss, /html\.vestige-payment-open \.site-header \.main-nav,[\s\S]*?display: none !important;/);
assert.match(paymentCss, /html\.vestige-payment-open \.site-header \.brand-logo \{[\s\S]*?width: 52px;/);
assert.match(publicScript, /payment-visibility\.css\?v=35\.22\.0&release=35\.26\.1/);
assert.match(paymentCss, /html\.vestige-payment-open #vestigeCheckoutJourney,[\s\S]*?display: none !important;/);
assert.match(paymentCss, /html\.vestige-payment-open #vestigeCheckoutGuidance[\s\S]*?visibility: hidden !important;/);
assert.match(ownerHtml, /id="testOrderResetPanel"/);
assert.match(ownerHtml, /Zoho Books invoices and payments are never changed/);
assert.match(ownerHtml, /highest preserved genuine reference plus one/);
assert.match(ownerScript, /admin_preview_test_order_reset/);
assert.match(ownerScript, /admin_apply_test_order_reset/);
assert.match(ownerScript, /testResetConfirmationRequired/);
assert.doesNotMatch(ownerScript, /RESET TO V0005/);

function row(namespace, key, value, etag = `${namespace}-${key}`) {
  return { namespace, key, value_json: JSON.stringify(value), etag, updated_at: 1 };
}

const fixture = [
  row('vestige-checkouts', 'checkout-real-1', { state: 'confirmed', progress: { paymentReference: 'V0001', bankInvoiceId: 'inv-1' } }),
  row('vestige-checkouts', 'checkout-test-2', { state: 'cancelled_customer', progress: { paymentReference: 'V0002' } }),
  row('vestige-checkouts', 'checkout-test-3', { state: 'expired', progress: { paymentReference: 'V0003' } }),
  row('vestige-checkouts', 'checkout-real-4', { state: 'confirmed', progress: { paymentReference: 'V0004', bankPaymentId: 'pay-4' } }),
  row('vestige-checkouts', 'checkout-test-5', { state: 'pending_payment', progress: { paymentReference: 'V0005' } }),
  row('vestige-order-sequence', 'bank-order', { value: 5, updatedAt: 1 }),
  row('vestige-bank-payment-reference-index', 'V0005', { checkoutId: 'test-5', paymentReference: 'V0005' }),
  row('vestige-notifications', 'new-order:V0005', { checkoutId: 'test-5', paymentReference: 'V0005' }),
  row('vestige-stock-reservations', 'item-1', {
    reservations: [
      { checkoutId: 'real-4', quantity: 1 },
      { checkoutId: 'test-5', quantity: 1 }
    ],
    updatedAt: 1
  })
];

const plan = reset.buildOwnerTestResetPlan(fixture);
assert.equal(plan.canApply, true);
assert.equal(plan.currentNextReference, 'V0006');
assert.equal(plan.nextReference, 'V0005');
assert.equal(plan.confirmationRequired, 'RESET TO V0005');
assert.deepEqual(plan.protectedReferences, ['V0001', 'V0004']);
assert.deepEqual(plan.deleteReferences, ['V0002', 'V0003', 'V0005']);
assert.deepEqual(plan.candidateSummaries.map(item => item.paymentReference), ['V0002', 'V0003', 'V0005']);
assert.equal(plan.blockers.length, 0);
assert.match(plan.fingerprint, /^[a-f0-9]{64}$/);
assert(plan.operations.some(op => op.type === 'delete' && op.row.namespace === 'vestige-checkouts' && op.row.key === 'checkout-test-5'));
assert(!plan.operations.some(op => op.row.key === 'checkout-real-1' || op.row.key === 'checkout-real-4'));
const reservationUpdate = plan.operations.find(op => op.type === 'update' && op.row.namespace === 'vestige-stock-reservations');
assert.deepEqual(reservationUpdate.value.reservations, [{ checkoutId: 'real-4', quantity: 1 }]);

const paidTestFixture = fixture.map(item => item.key === 'checkout-test-5'
  ? row('vestige-checkouts', 'checkout-test-5', { state: 'confirmed', progress: { paymentReference: 'V0005', bankInvoiceId: 'test-invoice' } })
  : item);
const blocked = reset.buildOwnerTestResetPlan(paidTestFixture);
assert.equal(blocked.canApply, true);
assert.equal(blocked.nextReference, 'V0006');
assert.deepEqual(blocked.protectedReferences, ['V0001', 'V0004', 'V0005']);
assert.deepEqual(blocked.deleteReferences, ['V0002', 'V0003']);
assert(!blocked.operations.some(op => op.row.key === 'checkout-test-5'));

const confirmingFixture = fixture.map(item => item.key === 'checkout-test-5'
  ? row('vestige-checkouts', 'checkout-test-5', { state: 'confirming_payment', progress: { paymentReference: 'V0005' } })
  : item);
assert.equal(reset.buildOwnerTestResetPlan(confirmingFixture).canApply, false, 'An in-progress payment confirmation must never be cleaned up.');

const laterFixture = [
  row('vestige-checkouts', 'checkout-real-1', { state: 'confirmed', progress: { paymentReference: 'V0001', bankInvoiceId: 'inv-1' } }),
  row('vestige-checkouts', 'checkout-test-2', { state: 'expired', progress: { paymentReference: 'V0002' } }),
  row('vestige-checkouts', 'checkout-real-4', { state: 'confirmed', progress: { paymentReference: 'V0004', bankPaymentId: 'pay-4' } }),
  row('vestige-checkouts', 'checkout-test-6', { state: 'cancelled_customer', progress: { paymentReference: 'V0006' } }),
  row('vestige-checkouts', 'checkout-real-7', { state: 'paid', progress: { paymentReference: 'V0007' } }),
  row('vestige-checkouts', 'checkout-test-8', { state: 'pending_payment', progress: { paymentReference: 'V0008' } }),
  row('vestige-checkouts', 'checkout-test-9', { state: 'expired', progress: { paymentReference: 'V0009' } }),
  row('vestige-order-sequence', 'bank-order', { value: 9, updatedAt: 1 })
];
const laterPlan = reset.buildOwnerTestResetPlan(laterFixture);
assert.equal(laterPlan.canApply, true);
assert.equal(laterPlan.targetSequence, 7);
assert.equal(laterPlan.nextReference, 'V0008');
assert.equal(laterPlan.confirmationRequired, 'RESET TO V0008');
assert.deepEqual(laterPlan.protectedReferences, ['V0001', 'V0004', 'V0007']);
assert.deepEqual(laterPlan.deleteReferences, ['V0002', 'V0006', 'V0008', 'V0009']);

const collisionPlan = reset.buildOwnerTestResetPlan([
  ...laterFixture.filter(item => item.key !== 'checkout-test-8'),
  row('vestige-bank-payment-reference-index', 'V0008', { checkoutId: 'unknown', paymentReference: 'V0008' })
]);
assert.equal(collisionPlan.canApply, false);
assert(collisionPlan.blockers.some(message => /calculated next reference V0008 is still reserved/.test(message)));

const exhaustedPlan = reset.buildOwnerTestResetPlan([
  row('vestige-checkouts', 'checkout-real-max', { state: 'confirmed', progress: { paymentReference: 'V99999999', bankInvoiceId: 'inv-max' } }),
  row('vestige-order-sequence', 'bank-order', { value: 99999999, updatedAt: 1 })
]);
assert.equal(exhaustedPlan.canApply, false);
assert.equal(exhaustedPlan.nextReference, null);
assert(exhaustedPlan.blockers.some(message => /reference range is exhausted/.test(message)));

const postCleanup = [
  fixture[0],
  fixture[3],
  row('vestige-order-sequence', 'bank-order', { value: 4, updatedAt: 2 }),
  row('vestige-stock-reservations', 'item-1', { reservations: [{ checkoutId: 'real-4', quantity: 1 }], updatedAt: 2 })
];
const verified = reset.buildOwnerTestResetPlan(postCleanup);
assert.equal(verified.currentSequence, 4);
assert.equal(verified.deleteReferences.length, 0);
assert.equal(verified.blockers.length, 0);
assert.equal(verified.canApply, false);

console.log('V35.24.3 extended payment-header, clean layering and dynamic owner-reset safeguards passed.');
