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

// Only the Vestige Standard card paragraphs are left aligned on desktop.
assert.match(
  styles,
  /\.discover-standard-grid article p\{[\s\S]*?text-align:left;[\s\S]*?hyphens:none;/,
  'Vestige Standard card body copy is not explicitly left aligned.'
);
assert.doesNotMatch(
  styles,
  /@media\(min-width:761px\)[\s\S]*?\.discover-standard-grid article p[\s\S]*?text-align:justify/,
  'Vestige Standard card body copy must not be included in desktop justification.'
);

// Requested justification remains everywhere else on desktop.
assert.match(
  styles,
  /@media\(min-width:761px\)[\s\S]*?\.discover-narrative p:not\(\.discover-impression\)[\s\S]*?\.discover-purpose-card p[\s\S]*?\.discover-experience-copy p:not\(\.discover-impression\)[\s\S]*?\.bc-editorial-copy>p[\s\S]*?\.component-story-copy>p[\s\S]*?\.local-seo-lede[\s\S]*?\.local-seo-grid article>p[\s\S]*?\.local-seo-copy>p[\s\S]*?text-align:justify;/,
  'Desktop editorial justification was not preserved outside the Vestige Standard cards.'
);

// Mobile remains naturally left aligned.
assert.match(
  styles,
  /@media\(max-width:760px\)[\s\S]*?text-align:left;[\s\S]*?hyphens:none;/,
  'Mobile readability fallback is missing.'
);

// Built from Experience: stretch full row then centre right-hand content within it.
assert.match(
  discover,
  /\.discover-experience-grid\{[^}]*align-items:stretch/,
  'Built from Experience grid does not stretch paired columns.'
);
assert.match(
  discover,
  /\.discover-experience-copy\{[^}]*align-self:stretch;[^}]*display:flex;[^}]*flex-direction:column;[^}]*justify-content:center/,
  'Built from Experience right-hand copy is not vertically centred within the full row height.'
);

// Other previously requested paired alignment remains robust.
assert.match(
  styles,
  /\.component-story \.feature-story-grid\{align-items:stretch\}/,
  'Component Story paired layout is not stretched for reliable centring.'
);
assert.match(
  styles,
  /\.component-story-copy\{[\s\S]*?align-self:stretch;[\s\S]*?justify-content:center;/,
  'Component Story right-hand copy is not vertically centred.'
);
assert.match(
  styles,
  /\.local-seo-grid\{align-items:stretch\}/,
  'Durbanville paired layout is not stretched.'
);
assert.match(
  styles,
  /\.local-seo-facts\{[\s\S]*?align-self:stretch;[\s\S]*?align-content:center;/,
  'Durbanville fact cards are not vertically centred.'
);

// Correct cache keys.
for (const [rel, token] of [
  ['public/index.html', '35.27.6'],
  ['public/bc10000/index.html', '35.27.6'],
  ['public/vape-durbanville.html', '35.27.6']
]) {
  assert.match(read(rel), new RegExp(`styles\\.css\\?v=${token}`), `${rel} does not load V${token} styles.`);
}
assert.match(home, /discover\.css\?v=35\.27\.6/, 'Home does not load V35.27.6 discover.css.');

console.log('V35.27.6 targeted justification and vertical-centering safeguards: PASS');
