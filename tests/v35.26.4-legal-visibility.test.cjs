'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root,'public','styles.css'),'utf8');
assert.match(css,/\.legal-page\{color:#111a26\}/,'legal page must set a dark foreground on its light background');
assert.match(css,/\.legal-page p,\.legal-page li\{color:#465261\}/,'legal body copy must have readable dark contrast');
assert.match(css,/\.legal-page \.legal-lead\{color:#586474;opacity:1\}/,'legal lead must not inherit faded opacity');
for (const file of ['privacy-policy.html','terms-and-conditions.html','returns-refunds.html']) {
  const html=fs.readFileSync(path.join(root,'public',file),'utf8');
  assert.match(html,/styles\.css\?v=35\.27\.6/,'legal page must use the current production stylesheet cache version: '+file);
  assert.match(html,/class="legal-page"/,'legal page class missing: '+file);
}
console.log('PASS V35.26.4 legal-page visibility safeguards');
