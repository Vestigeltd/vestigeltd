'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const owner = read('public/owner.html');
const ownerCss = read('public/owner.css');

assert.match(
  owner,
  /id="lockConsole"[^>]*hidden/,
  'The Lock Console control must be hidden in the locked initial state.'
);
assert.match(
  ownerCss,
  /\.owner-lock-button\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/,
  'Owner CSS must prevent shared button display rules from overriding the hidden state.'
);
assert.match(owner, /owner\.css\?v=35\.28\.1/, 'Owner CSS cache key must be V35.28.1.');

console.log('V35.28.1 owner lock visibility safeguard: PASS');
