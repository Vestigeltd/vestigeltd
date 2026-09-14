'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const styles = read('public/styles.css');
const discover = read('public/discover.css');
const home = read('public/index.html');
const shop = read('public/bc10000/index.html');
const local = read('public/vape-durbanville.html');

assert.match(styles, /--vestige-space-heading-content:54px/, 'Shared desktop heading-to-content spacing token missing.');
assert.match(styles, /\.section-heading\{margin-bottom:var\(--vestige-space-heading-content\)\}/, 'Section headings do not use the shared spacing token.');
assert.match(styles, /@media\(max-width:760px\)[\s\S]*--vestige-space-heading-content:36px/, 'Responsive heading spacing token missing.');
assert.match(discover, /discover-signature\{[^}]*margin:0 auto var\(--vestige-space-heading-content,54px\)/, 'Discover signature does not share the site spacing rhythm.');
assert.match(discover, /discover-experience-grid\{[^}]*align-items:stretch/, 'Built from Experience paired row is not stretched for reliable vertical centring.');
assert.match(styles, /\.component-story \.feature-story-grid\{align-items:stretch\}/, 'Component Story vertical centering safeguard missing.');
assert.match(styles, /\.local-seo-grid\{align-items:stretch\}/, 'Durbanville facts are not vertically centred against the narrative.');
assert.match(styles, /\.local-seo-facts\{[\s\S]*align-self:stretch;[\s\S]*align-content:center;/, 'Durbanville fact-card block vertical centering safeguard missing.');
assert.match(styles, /@media\(min-width:761px\)[\s\S]*\.discover-narrative p:not\(\.discover-impression\)[\s\S]*text-align:justify/, 'Desktop Discover narrative justification missing.');
assert.match(styles, /@media\(min-width:761px\)[\s\S]*\.bc-editorial-copy>p[\s\S]*\.component-story-copy>p[\s\S]*\.local-seo-lede[\s\S]*text-align:justify/, 'Requested desktop editorial justification coverage missing.');
assert.match(styles, /@media\(max-width:760px\)[\s\S]*text-align:left;[\s\S]*hyphens:none/, 'Mobile readability fallback for justified copy missing.');
assert.match(shop, /Vestige Vapes is the specialist vape retail expression of Vestige\./, 'Vestige Vapes brand-architecture wording was not updated.');
assert.doesNotMatch(shop, /Vestige Vapes is the vaping business of Vestige Ltd/, 'Legacy Vestige Vapes corporate wording remains.');
assert.match(home, /styles\.css\?v=35\.27\.6/, 'Home does not load the V35.27.6 stylesheet.');
assert.match(home, /discover\.css\?v=35\.27\.6/, 'Home does not load the V35.27.6 Discover stylesheet.');
assert.match(shop, /styles\.css\?v=35\.27\.6/, 'BC10000 page does not load the V35.27.6 stylesheet.');
assert.match(local, /styles\.css\?v=35\.27\.6/, 'Durbanville page does not load the V35.27.6 stylesheet.');

for (const rel of [
  'public/index.html','public/bc10000/index.html','public/contact.html','public/vape-durbanville.html',
  'public/privacy-policy.html','public/terms-and-conditions.html','public/returns-refunds.html',
  'public/flavours/blueberry-mint.html','public/flavours/miami-mint.html','public/flavours/blue-razz-ice.html',
  'public/flavours/strawberry-kiwi-ice.html','public/flavours/watermelon-ice.html'
]) {
  assert.doesNotMatch(read(rel), /styles\.css\?v=35\.27\.2/, `Stale V35.27.2 stylesheet cache key remains in ${rel}`);
}

console.log('V35.27.6 inherited editorial rhythm safeguards: PASS');
