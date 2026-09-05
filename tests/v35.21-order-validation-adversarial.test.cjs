'use strict';

const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const root = path.resolve(__dirname, '..');
const workerPath = path.join(root, 'src', 'zoho-integration.cjs');
const source = fs.readFileSync(workerPath, 'utf8');
const instance = new Module(workerPath, module);
instance.filename = workerPath;
instance.paths = Module._nodeModulePaths(path.dirname(workerPath));
instance._compile(source + '\nexports.__orderValidationTest={validateBankCartOrder,validateCheckoutId,validateCourierLocker,validateDeliveryMethod,customerOrderStatusMessage};\n', workerPath);
const hooks = instance.exports.__orderValidationTest;

const base = {
  customerName: 'Test Customer',
  email: 'customer@example.com',
  mobile: '+27 82 123 4567',
  addressLine1: '1 Test Street',
  addressLine2: 'Test Suburb',
  city: 'Cape Town',
  province: 'Western Cape',
  postalCode: '8001',
  country: 'South Africa',
  deliveryMethod: 'courier_locker',
  courierLocker: 'TEST LOCKER 123',
  checkoutId: 'checkout-1234567890',
  items: [{ flavour: 'Blueberry Mint', itemId: '123456789', quantity: 1 }],
  amount: 360,
};

function rejects(change, messagePart, options) {
  const payload = structuredClone(base);
  change(payload);
  assert.throws(() => hooks.validateBankCartOrder(payload, options), error => {
    assert(String(error.message).includes(messagePart), `Expected "${messagePart}", received "${error.message}"`);
    return true;
  });
}

const courier = hooks.validateBankCartOrder(base);
assert.equal(courier.amount, 360);
assert.equal(courier.deliveryCharge, 60);
assert.equal(courier.totalQuantity, 1);

const mixed = hooks.validateBankCartOrder({
  ...base,
  items: [
    { flavour: 'Blueberry Mint', itemId: '123456789', quantity: 5 },
    { flavour: 'Miami Mint', itemId: '223456789', quantity: 4 },
    { flavour: 'Blue Razz Ice', itemId: '323456789', quantity: 3 },
    { flavour: 'Strawberry Kiwi Ice', itemId: '423456789', quantity: 2 },
    { flavour: 'Watermelon Ice', itemId: '523456789', quantity: 1 },
  ],
  amount: 4560,
});
assert.equal(mixed.totalQuantity, 15);
assert.equal(mixed.amount, 4560);

const collection = hooks.validateBankCartOrder({ ...base, deliveryMethod: 'collection', courierLocker: '', amount: 300 }, { trustedStored: true });
assert.equal(collection.deliveryCharge, 0);
assert.equal(collection.courierLocker, 'Collection');
assert.equal(collection.amount, 300);

rejects(p => { p.customerName = 'X'; }, 'valid customer name');
rejects(p => { p.email = 'customer-at-example'; }, 'valid email address');
rejects(p => { p.mobile = '123'; }, 'valid mobile number');
rejects(p => { p.addressLine1 = 'X'; }, 'billing street address');
rejects(p => { p.addressLine2 = ''; }, 'complete billing/contact address');
rejects(p => { p.city = ''; }, 'complete billing/contact address');
rejects(p => { p.province = ''; }, 'complete billing/contact address');
rejects(p => { p.postalCode = '1'; }, 'complete billing/contact address');
rejects(p => { p.deliveryMethod = 'free_delivery'; }, 'valid delivery or collection');
rejects(p => { p.courierLocker = '<script>'; }, 'Courier Locker is required');
rejects(p => { p.checkoutId = '../invalid'; }, 'Invalid checkout request identifier');
rejects(p => { p.items = []; }, 'Add at least one valid flavour');
rejects(p => { p.items = new Array(6).fill({ flavour: 'Miami Mint', itemId: '123', quantity: 1 }); }, 'Add at least one valid flavour');
rejects(p => { p.items[0].flavour = 'Unknown'; }, 'valid BC10000 flavour');
rejects(p => { p.items[0].itemId = 'abc'; }, 'verified Zoho item identifier');
rejects(p => { p.items[0].quantity = 0; }, 'between 1 and 5');
rejects(p => { p.items[0].quantity = 6; }, 'between 1 and 5');
rejects(p => { p.items[0].quantity = 1.5; }, 'between 1 and 5');
rejects(p => { p.amount = 359.98; }, 'submitted total does not match');
rejects(p => { p.amount = 'not-a-number'; }, 'submitted total does not match');
rejects(p => { p.items.push({ flavour: 'Blueberry Mint', itemId: '987654321', quantity: 1 }); p.amount = 660; }, 'Each flavour may appear only once');
rejects(p => { p.items.push({ flavour: 'Miami Mint', itemId: '123456789', quantity: 1 }); p.amount = 660; }, 'Each flavour may appear only once');

assert.deepEqual(hooks.customerOrderStatusMessage('confirmed'), { status: 'confirmed', title: 'Order confirmed', message: 'Your payment has been verified and your order is confirmed.' });
assert.equal(hooks.customerOrderStatusMessage('pending_payment').status, 'pending');
assert.equal(hooks.customerOrderStatusMessage('confirming_payment').status, 'pending');
assert.equal(hooks.customerOrderStatusMessage('cancelled_customer').status, 'cancelled');
assert.equal(hooks.customerOrderStatusMessage('expired').status, 'expired');

const claimStart = source.indexOf('async function claimBankPayment');
const claimEnd = source.indexOf('async function prepareBankOrder', claimStart);
const claimSource = source.slice(claimStart, claimEnd);
assert(claimSource.includes("state === 'confirmed'"));
assert(claimSource.includes("['pending_payment', 'confirming_payment'].includes(state)"));
assert(claimSource.includes('paymentReviewHoldStatus'));
assert(!claimSource.includes('createBankInvoice('));
assert(!claimSource.includes('createBankCustomerPayment('));
assert(!claimSource.includes('strictlyConfirmBankCheckout('));

const confirmationStart = source.indexOf('async function confirmBankPaymentManually');
const confirmationEnd = source.indexOf('async function adminRecentBankOrders', confirmationStart);
const confirmationSource = source.slice(confirmationStart, confirmationEnd);
assert(confirmationSource.includes('bankCreditConfirmed !== true'));
assert(confirmationSource.includes('Confirmed bank credit must equal the exact order total'));
assert(confirmationSource.includes('assertBankInvoiceMatches'));
assert(confirmationSource.includes('assertBankPaymentMatches'));
assert(confirmationSource.includes('strictlyConfirmBankCheckout'));

console.log('V35.21 order-validation adversarial checks passed (44 assertions).');
