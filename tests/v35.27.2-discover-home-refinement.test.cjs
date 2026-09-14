'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const home = read('public/index.html');
const discover = read('public/discover.css');
const styles = read('public/styles.css');

assert.match(home, /<span class="brand-name">VESTIGE <b>LTD<\/b><\/span>/, 'Vestige Ltd header identity missing.');
assert.match(home, /discover-header-title">Discover Vestige</, 'Discover Vestige is not positioned in the logo-height header group.');
assert.match(discover, /\.discover-page \.brand-name,\.discover-page \.brand-name b\{color:#d4aa58/, 'Landing-page Vestige wordmark is not gold.');
assert.match(discover, /\.discover-header-title\{[^}]*font-family:Georgia/, 'Discover Vestige header title styling missing.');
assert.match(home, /discover-signature">What remains is the experience\.<\/p>/, 'Signature line missing.');
assert.match(discover, /\.discover-signature\{[^}]*text-align:center/, 'Signature line is not centered.');
assert.match(home, /Vestige takes its name from the reciprocal imprint of experience — the traces that people, places and encounters leave on us, and the marks we leave behind in return\./, 'Approved reciprocal Vestige origin copy missing.');
assert.match(discover, /\.discover-narrative \.discover-origin\{[^}]*font-size:16px/, 'Origin sentence must remain body-copy size.');
assert.match(discover, /\.discover-narrative p\{[^}]*font-size:16px/, 'Narrative body-copy size changed unexpectedly.');
assert.match(home, /When the transaction ends\. The impression remains\./, 'Transaction/impression sentence is not corrected.');
assert.doesNotMatch(home, /Because the transaction ends/, 'Old transaction wording remains.');
assert.match(discover, /\.discover-triad\{[^}]*text-align:center/, 'Considered/Clear/Distinctive line is not centered.');
assert.match(home, /discover-hero-action/, 'Opening BC10000 CTA is missing after the V35.27.6 tester-feedback restoration.');
assert.match(discover, /\.discover-mark\{align-self:center/, 'Right-side principle marker is not centered against the body-copy grid.');
assert.match(home, /discover-standard-title">Four principles\. One experience\.<\/h2>/, 'Standard heading missing.');
assert.match(home, /discover-purpose-title">Built around a standard, not a slogan\.<\/h2>/, 'Purpose heading missing.');
assert.match(discover, /\.discover-single-line\{white-space:nowrap\}/, 'Required one-line heading control missing.');
assert.match(discover, /\.discover-standard-grid \.feature-number\{font-size:var\(--discover-accent-size\)/, 'Principle labels do not match the triad size token.');
assert.match(home, /The Vestige story began in Edinburgh, Scotland\./, 'Edinburgh, Scotland provenance wording missing.');
assert.match(home, /class="nav-home" href="\/" aria-current="page">Home<\/a>/, 'Dedicated Home button missing from brand page.');
assert.match(styles, /\.main-nav \.nav-home\{/, 'Global Home-button styling missing.');

for (const rel of [
  'public/bc10000/index.html',
  'public/contact.html',
  'public/privacy-policy.html',
  'public/terms-and-conditions.html',
  'public/returns-refunds.html',
  'public/vape-durbanville.html',
  'public/flavours/blueberry-mint.html',
  'public/flavours/miami-mint.html',
  'public/flavours/blue-razz-ice.html',
  'public/flavours/strawberry-kiwi-ice.html',
  'public/flavours/watermelon-ice.html'
]) {
  assert.match(read(rel), /class="nav-home" href="\/">Home<\/a>/, `Visible Home control missing in ${rel}`);
}

assert.match(read('public/owner.html'), /href="\/">Home<\/a>/, 'Owner console Home button missing.');
assert.match(read('public/order-status.html'), /href="\/">Home<\/a>/, 'Order Status Home button missing.');

for (const rel of [
  'public/vape-durbanville.html',
  'public/flavours/blueberry-mint.html',
  'public/flavours/miami-mint.html',
  'public/flavours/blue-razz-ice.html',
  'public/flavours/strawberry-kiwi-ice.html',
  'public/flavours/watermelon-ice.html'
]) {
  assert.doesNotMatch(read(rel), /href="\/#flavours"/, `Stale root flavour anchor remains in ${rel}`);
}

console.log('V35.27.2 Discover Vestige refinement safeguards: PASS');
