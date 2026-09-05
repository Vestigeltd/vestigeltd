'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const storefront = read('public/script.js');
const journey = read('public/checkout-journey-safe.js');
const styles = read('public/styles.css');
const paymentVisibility = read('public/payment-visibility.css');
const index = read('public/index.html');
const contact = read('public/contact.html');
const integration = read('src/zoho-integration.cjs');

assert(!storefront.includes('<div class="vcs-kicker">YOUR SELECTION</div>'), 'Obsolete selection panel markup remains.');
assert(storefront.includes("if (panel) panel.remove();"), 'Selection-panel defensive removal is missing.');
assert(storefront.includes("document.getElementById('vestigeCheckoutJourney')"), 'Reactive journey target is missing.');
assert(storefront.includes("document.addEventListener('vestige:journey-ready', updateSummary)"), 'Journey readiness update is missing.');
assert(!journey.includes('class="vcjs-pricing"'), 'Obsolete fixed quantity/price boxes remain.');
assert(!styles.includes('.vcjs-pricing{'), 'Obsolete fixed-pricing CSS remains.');
assert(storefront.includes("form.dataset.basketSummary=JSON.stringify(summary)"), 'Authoritative basket summary is not published.');
assert(storefront.includes("document.addEventListener('vestige:cart-updated', updateSummary)"), 'Reactive basket update listener is missing.');
assert(journey.includes("document.addEventListener('vestige:cart-updated', updateJourney)"), 'Checkout progress does not react to basket updates.');
assert(!journey.includes('id="vcsExpand"'), 'Obsolete collapse/expand control remains.');
assert(!journey.includes("classList.toggle('is-stuck'"), 'Obsolete flattened sticky state remains.');
assert(journey.includes('function bindPinnedGuide(journey)'), 'Full pinned-guide binding is missing.');
assert(journey.includes("journey.style.setProperty('--vcjs-sticky-top', headerHeight + 'px')"), 'Dynamic header offset is missing.');
assert(journey.includes('class="vcjs-process"'), 'Left process rail is missing.');
assert(journey.includes('class="vcjs-data"'), 'Right live-data rail is missing.');
assert(styles.includes('@media(min-width:900px)'), 'Usable desktop side-rail breakpoint is missing.');
assert(styles.includes('.checkout-shell{max-width:min(940px,calc(100vw - var(--vcjs-rail-width) - var(--vcjs-rail-width) - 44px))}'), 'Centre form does not reserve space for both rails.');
assert(styles.includes('grid-template-columns:var(--vcjs-rail-width) minmax(0,1fr) var(--vcjs-rail-width);'), 'Responsive left/centre/right rail structure is missing.');
assert(styles.includes('.vcjs-process{grid-column:1;gap:14px}'), 'Process rail is not positioned on the left.');
assert(styles.includes('.vcjs-data{grid-column:3;gap:12px}'), 'Live-data rail is not positioned on the right.');
assert(styles.includes('position:sticky;'), 'Desktop side-rail pinning is missing.');
assert(styles.includes('height:0;'), 'Side-rail layer still consumes form height.');
assert(styles.includes('.order-form{background:#fff;border:1px solid #d9dde2;box-shadow:0 20px 54px rgba(23,37,56,.09);padding:0;overflow:visible}'), 'Shop form still blocks viewport-sticky positioning.');
assert(storefront.includes("BASKET_SESSION_KEY='vestigeBasketV1'"), 'Session basket persistence key is missing.');
assert(storefront.includes('function restoreBasketSession()'), 'Session basket restoration is missing.');
assert(storefront.includes('function revalidateBasketAgainstAvailability()'), 'Restored basket live-stock validation is missing.');
assert(storefront.includes('restoreBasketSession();\n  syncFulfilmentUi();'), 'Basket is not restored before its first render.');
assert(styles.includes('#vestigeCartBuilder{margin-top:7px}'), 'Requested 7px basket-control spacing is missing.');
assert(styles.includes('.customer-details-block{margin-top:10px}'), 'Requested 10px Customer spacing is missing.');
assert(journey.includes("journey.style.setProperty('--vcjs-end-shift', Math.min(0, clearance) + 'px')"), 'FAQ contact-aware rail release is missing.');
assert(styles.includes('transform:translateY(var(--vcjs-end-shift,0px));'), 'FAQ rail-release movement is missing.');
assert(journey.includes('window.requestAnimationFrame(syncPinnedGeometry)'), 'Rail geometry is not frame-synchronised.');
assert(!styles.includes('transition:transform .08s linear'), 'Lagging per-scroll rail transition remains.');
assert(storefront.includes("form.classList.add('is-payment-mode')"), 'Payment-only mode is not activated.');
assert(storefront.includes("form.classList.remove('is-payment-mode')"), 'Cancellation does not restore the checkout form.');
assert(styles.includes('.order-form.is-payment-mode>:not(#paymentPanel):not(#receiptPanel):not(#orderStatus){display:none!important}'), 'Payment-only screen isolation is missing.');
assert(!storefront.includes("document.documentElement.classList.add('vestige-payment-focus')"), 'Regressed expanded payment viewport mode remains.');
assert(styles.includes('.order-form.is-payment-mode{background:#fff;border-color:#d9dde2}'), 'Vetted light payment-page surround is missing.');
assert(storefront.includes("payment-visibility.css?v=35.22.0"), 'Responsive payment safeguards are not loaded.');
assert(paymentVisibility.includes('.bank-qr-shell'), 'Responsive QR visibility safeguard is missing.');
assert(paymentVisibility.includes('@media (max-width: 640px)'), 'Small-screen payment layout is missing.');
assert(paymentVisibility.includes('min-height: 44px'), 'Payment control touch targets are not protected.');
for (const id of ['capitecCard','eftCard','summaryItems','bankReference','bankAmount']) {
  assert(storefront.includes(`id="${id}"`), `Required payment object is missing: ${id}`);
}
assert(!styles.includes('.vestige-checkout-journey-safe.is-stuck'), 'Flattened sticky styling remains.');
assert(styles.includes('background:#101e30;'), 'Pinned guide does not have an opaque background for content scrolling beneath it.');
assert(storefront.includes("items.map(item => item.flavour + ' × ' + item.quantity).join(', ')"), 'Multi-flavour basket summary is missing.');
for (const id of ['vcsFlavour','vcsQty','vcsProducts','vcsDelivery','vcsTotal','vcsNote']) {
  assert(journey.includes(`id="${id}"`), `Reactive journey field is missing: ${id}`);
}
assert(journey.includes("new CustomEvent('vestige:journey-ready')"), 'Journey readiness event is missing.');
assert(journey.includes("enterSite.addEventListener('click', () => window.setTimeout(start, 0))"), 'Post-age-gate journey initialization is missing.');
assert(styles.includes('@media(max-width:680px)'), 'Mobile journey breakpoint is missing.');

const productPos = index.indexOf('id="productSelectionHeading"');
const deliveryPos = index.indexOf('id="deliveryHeading"');
const basketPos = index.indexOf('id="vestigeCartBuilder"');
const customerPos = index.indexOf('id="customerHeading"');
const billingPos = index.indexOf('id="billingHeading"');
const submitPos = index.indexOf('id="orderSubmit"');
assert(productPos < deliveryPos && deliveryPos < basketPos && basketPos < customerPos && customerPos < billingPos && billingPos < submitPos, 'Checkout sections are not in the approved 1–4 order.');
assert(index.includes('<span>02</span><h3 id="deliveryHeading">'), 'Delivery is not numbered 02.');
assert(index.includes('<span>03</span><h3 id="customerHeading">'), 'Customer is not numbered 03.');
assert(index.includes('<span>04</span><h3 id="billingHeading">'), 'Billing is not numbered 04.');

assert(contact.includes('class="contact-email"'), 'Contact email colour hook is missing.');
assert(contact.includes('class="contact-instagram"'), 'Instagram colour hook is missing.');
assert(styles.includes('.contact-card .contact-detail .contact-email{color:#806018;font-weight:700}'), 'Dark-gold email styling is missing.');
assert(styles.includes('.contact-card .contact-detail .contact-instagram{color:#172231;font-weight:700}'), 'Strong contact-value styling is missing.');
assert(index.includes('styles.css?v=35.23.2'), 'Storefront stylesheet cache version is stale.');
assert(index.includes('script.js?v=35.23.2'), 'Storefront script cache version is stale.');
assert(index.includes('checkout-journey-safe.js?v=35.22.0'), 'Journey script cache version is stale.');
assert(contact.includes('styles.css?v=35.23.2'), 'Contact stylesheet cache version is stale.');

assert(integration.includes('const safeFirstName = firstName'), 'Safe first-name personalisation is missing.');
assert(integration.includes(".replace(/</g, '&lt;')"), 'First-name HTML escaping is missing.');
assert(integration.includes('from Vestige for your order and support'), 'Customer thank-you wording is missing.');
assert(integration.includes("send_attachment: 'true'"), 'Zoho invoice attachment request changed or is missing.');

const cleanup = require(path.join(root, 'src/cleanup-expired-checkouts.cjs'));
const retention = cleanup.__retentionTest;
assert(retention, 'Retention test helpers are unavailable.');
assert.strictEqual(retention.paymentReferenceFromCheckout({progress:{paymentReference:'v0004'}}), 'V0004');
assert.strictEqual(retention.paymentReferenceFromCheckout({response:{paymentReference:'V0008'}}), 'V0008');
assert.strictEqual(retention.isProtectedFinancialCheckout({progress:{paymentReference:'V0001'}}), true);
assert.strictEqual(retention.isProtectedFinancialCheckout({response:{paymentReference:'v0002'}}), true);
assert.strictEqual(retention.isProtectedFinancialCheckout({progress:{paymentReference:'V0004'}}), true);
assert.strictEqual(retention.isProtectedFinancialCheckout({progress:{paymentReference:'V0008'}}), false);

const minimised = retention.minimisedConfirmedCheckout({
  state:'confirmed',
  fingerprint:'personal-data-derived-hash',
  progress:{
    paymentReference:'V0008', paymentMode:'bank_transfer', amount:660,
    deliveryMethod:'courier_locker', deliveryCharge:60, courierLocker:'Private Locker',
    customer:{customerName:'Jane Example',email:'jane@example.com',mobile:'0123',addressLine1:'Private Road'},
    items:[{flavour:'Miami Mint',itemId:'123',quantity:2}], totalQuantity:2,
    bankInvoiceId:'invoice-1',bankPaymentId:'payment-1',bankPaymentDate:'2026-09-04',bankConfirmedAmount:660,
  },
  verified:{paymentId:'payment-1',invoiceId:'invoice-1',amount:660,confirmedAt:'2026-09-04T00:00:00.000Z'},
  response:{checkoutToken:'secret-token'},
}, Date.parse('2026-12-04T00:00:00.000Z'));

const retainedJson = JSON.stringify(minimised);
for (const forbidden of ['Jane Example','jane@example.com','0123','Private Road','Private Locker','secret-token','personal-data-derived-hash']) {
  assert(!retainedJson.includes(forbidden), `Personal or secret value remained after minimisation: ${forbidden}`);
}
for (const required of ['V0008','invoice-1','payment-1','Miami Mint']) {
  assert(retainedJson.includes(required), `Required non-personal order linkage was removed: ${required}`);
}

console.log('V35.22.0 focused regression checks passed.');
