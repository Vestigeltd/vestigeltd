'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const home = read('public/index.html');
const discover = read('public/discover.css');
const styles = read('public/styles.css');

// The opening product bridge is restored immediately after the brand triad.
assert.match(
  home,
  /<p class="discover-triad">Considered\. Clear\. Distinctive\.<\/p>\s*<div class="discover-hero-action">\s*<a class="btn btn-gold" href="\/bc10000\/"[^>]*>Discover the ELFBAR BC10000 range<\/a>\s*<\/div>/,
  'Opening ELFBAR BC10000 product bridge is missing or misplaced.'
);

// It must remain within the Discover Vestige hero, before THE VESTIGE STANDARD.
const triad = home.indexOf('class="discover-triad"');
const action = home.indexOf('class="discover-hero-action"');
const standard = home.indexOf('id="standard"');
assert.ok(triad >= 0 && action > triad && standard > action, 'Opening product bridge is outside the intended hero position.');

// The CTA remains visually centred and uses the established button system.
assert.match(discover, /\.discover-hero-action\{[^}]*text-align:center;[^}]*margin:/, 'Hero product bridge is not centred.');
assert.match(home, /class="btn btn-gold" href="\/bc10000\/"/, 'Hero product bridge does not use the established gold CTA component.');

// Preserve V35.27.5 typography/alignment contract.
assert.match(styles, /\.discover-standard-grid article p\{[\s\S]*?text-align:left;[\s\S]*?hyphens:none;/, 'Vestige Standard left alignment regressed.');
assert.match(discover, /\.discover-experience-copy\{[^}]*align-self:stretch;[^}]*display:flex;[^}]*flex-direction:column;[^}]*justify-content:center/, 'Built from Experience vertical centring regressed.');

// Current cache keys.
assert.match(home, /styles\.css\?v=35\.27\.6/, 'Home does not load V35.27.6 styles.');
assert.match(home, /discover\.css\?v=35\.27\.6/, 'Home does not load V35.27.6 discover.css.');

console.log('V35.27.6 opening ELFBAR BC10000 product bridge safeguards: PASS');
