const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public', 'script.js'), 'utf8');

assert.match(html, /id="soldOutOverlay"[^>]*role="status"/);
assert.match(html, /<h3>Sold out<\/h3><p>Will have stock soon<\/p>/);
assert.match(html, /id="soldOutRetry"[^>]*>Check stock again<\/button>/);
assert.match(css, /\.checkout-shell\.is-sold-out \.order-form\{[^}]*pointer-events:none/);
assert.match(css, /\.sold-out-overlay\{[^}]*position:absolute;inset:0;z-index:24/);
assert.match(script, /setShopSoldOut\(allSoldOut\)/);
assert.match(script, /catch\(e\)\{setShopSoldOut\(false\)/, 'An availability failure must not be described as sold out.');
assert.match(script, /!!soldOut&&!activeCheckout&&!checkoutToken/, 'A pending payment must override the storefront sold-out overlay.');
assert.match(script, /form\.toggleAttribute\('inert',effective\)/, 'The order form must become non-interactive while sold out.');

const functionMatch = script.match(/function availabilityConfirmsSoldOut\(\)\{[\s\S]*?\n  \}/);
assert(functionMatch, 'Sold-out classification function is missing.');
const names = ['Blueberry Mint', 'Miami Mint', 'Blue Razz Ice', 'Strawberry Kiwi Ice', 'Watermelon Ice'];
const flavour = { options: [{ value: '' }, ...names.map(value => ({ value }))] };
function classify(availability) {
  return vm.runInNewContext(`${functionMatch[0]}; availabilityConfirmsSoldOut()`, { flavour, availability, Number, Array, String });
}

assert.equal(classify(Object.fromEntries(names.map(name => [name, { available: false, stock: 0 }]))), true, 'All five confirmed zero-stock products must activate sold out.');
assert.equal(classify(Object.fromEntries(names.map((name, index) => [name, { available: index === 0, stock: index === 0 ? 1 : 0 }]))), false, 'One in-stock flavour must keep the Shop available.');
assert.equal(classify(Object.fromEntries(names.slice(0, 4).map(name => [name, { available: false, stock: 0 }]))), false, 'Missing inventory data must not be misclassified as sold out.');
assert.equal(classify(Object.fromEntries(names.map(name => [name, { available: false }]))), false, 'Unavailable products without numeric stock evidence must not trigger sold out.');

console.log('V35.23.2 all-stock sold-out safeguards passed.');
