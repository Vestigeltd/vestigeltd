'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const home = read('public/index.html');
const product = read('public/bc10000/index.html');
const script = read('public/script.js');
const styles = read('public/styles.css');
const bankCss = read('public/bank-payments.css');
const integration = read('src/zoho-integration.cjs');
const pkg = JSON.parse(read('package.json'));

assert.strictEqual(pkg.version, '35.28.1', 'Package version is not V35.28.1.');

assert(home.includes('<a class="nav-buy" href="/bc10000/">ELFBAR VAPES</a>'), 'Homepage BC10000 navigation label was not changed to ELFBAR VAPES.');
assert(product.includes('<a href="#product">ELFBAR VAPES</a>'), 'Product-page BC10000 navigation label was not changed to ELFBAR VAPES.');
assert(product.includes('/styles.css?v=35.27.6&ui=35.28.0'), 'BC10000 stylesheet cache key was not advanced.');
assert(product.includes('/script.js?v=35.23.2&ui=35.28.0'), 'BC10000 script cache key was not advanced.');

assert(script.includes("bankCss.href='/bank-payments.css?v=35.22.0&release=35.27.9'"), 'Bank presentation stylesheet is not loaded from a root-absolute URL with a fresh release key.');
assert(script.includes("paymentVisibilityCss.href='/payment-visibility.css?v=35.22.0&release=35.26.1&ui=35.27.9'"), 'Payment visibility stylesheet is not loaded from a root-absolute URL with a fresh UI key.');
assert(!script.includes("bankCss.href='bank-payments.css"), 'A route-relative bank stylesheet URL remains.');
assert(!script.includes("paymentVisibilityCss.href='payment-visibility.css"), 'A route-relative payment stylesheet URL remains.');

for (const token of [
  'class="cart-columns"',
  'class="cart-items"',
  'class="cart-totals"',
  'class="cart-total-line"',
  'cart-grand-total',
  'class="cart-mobile-label"'
]) {
  assert(script.includes(token), `Premium basket markup is missing ${token}.`);
}
assert(styles.includes('V35.27.9 — premium multi-item basket presentation'), 'V35.27.9 basket presentation CSS is missing.');
assert(styles.includes('#vestigeCart .cart-columns'), 'Basket desktop alignment grid is missing.');
assert(styles.includes('@media(max-width:720px)'), 'Basket mobile presentation safeguard is missing.');

assert(script.includes("label.className='eft-label'"), 'EFT row label hook is missing.');
assert(script.includes("value.className='eft-value'"), 'EFT row value hook is missing.');
assert(bankCss.includes('V35.27.9 — payment presentation refinement'), 'V35.27.9 payment presentation CSS is missing.');
assert(bankCss.includes('grid-template-columns:minmax(125px,.62fr) minmax(0,1.38fr) 78px'), 'EFT label/value/copy alignment grid is missing.');
assert(bankCss.includes('.bank-status-actions{display:grid;grid-template-columns:1fr 1fr'), 'Payment action alignment is missing.');
assert(bankCss.includes('.summary-product{'), 'Structured order-summary row styling is missing.');

assert(script.includes("function currentDeliveryPrice(){return selectedDeliveryMethod()==='collection'?0:DELIVERY_PRICE;}"), 'Client fulfilment charge helper changed unexpectedly.');
assert(script.includes("function cartGrandTotal(){return cart.length?cartProductsTotal()+currentDeliveryPrice():0;}"), 'Client basket total must apply the fulfilment charge only once.');
assert(integration.includes('const amount = totalQuantity * PRODUCT_PRICE_ZAR + deliveryCharge;'), 'Server basket pricing must apply delivery/collection charge once per complete order.');
assert(integration.includes('shipping_charge: Number(order.deliveryCharge || 0),'), 'Zoho bank invoice must use the single order-level delivery charge.');

console.log('V35.27.9 checkout presentation and single-delivery safeguards: PASS');
