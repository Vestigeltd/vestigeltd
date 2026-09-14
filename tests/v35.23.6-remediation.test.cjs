'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'src', 'worker.js'), 'utf8');
const zoho = fs.readFileSync(path.join(root, 'src', 'zoho-integration.cjs'), 'utf8');
const owner = fs.readFileSync(path.join(root, 'public', 'owner.js'), 'utf8');
const ownerHtml = fs.readFileSync(path.join(root, 'public', 'owner.html'), 'utf8');

assert.match(zoho, /getProductAvailability\(false, false, true\)/, 'Public availability must apply website reservations.');
assert.match(zoho, /applyAvailabilityReservations/, 'Reservation overlay helper must exist.');
assert.match(zoho, /websiteReserved/, 'Availability response must expose reservation-adjusted state.');
assert.match(zoho, /exports\.getGoogleFacingAvailability/, 'Worker must have a controlled Google-facing availability helper.');
assert.match(worker, /injectGoogleAvailability/, 'Flavour HTML must receive server-side availability enrichment.');
assert.match(worker, /https:\/\/schema\.org\/InStock/, 'In-stock schema value missing.');
assert.match(worker, /https:\/\/schema\.org\/OutOfStock/, 'Out-of-stock schema value missing.');
assert.match(worker, /\.html\$\/.test\(url\.pathname\)/, 'Clean flavour canonical redirect missing.');
assert.doesNotMatch(owner, /sessionStorage\.setItem\(['"]vestigeOwnerKey/, 'Owner key must not be persisted.');
assert.doesNotMatch(owner, /sessionStorage\.getItem\(['"]vestigeOwnerKey/, 'Owner key must not be restored from storage.');
assert.match(ownerHtml, /Keep key in memory only/, 'Owner console must clearly state memory-only key handling.');
assert.equal(fs.readdirSync(path.join(root, 'public'), {withFileTypes:true}).filter(e=>e.name.endsWith('.bak')).length, 0, 'Public root must not contain backup assets.');
for (const name of fs.readdirSync(path.join(root, 'public', 'flavours'))) assert.doesNotMatch(name, /\.bak$/, 'Public flavour directory contains a backup asset.');
for (const slug of ['privacy-policy','terms-and-conditions','returns-refunds']) {
  const f=path.join(root,'public',slug+'.html');
  assert.ok(fs.existsSync(f), `Missing legal page: ${slug}`);
  const html=fs.readFileSync(f,'utf8');
  assert.match(html, new RegExp(`<link rel="canonical" href="https://vestigeltd\\.co\\.za/${slug}"`));
}
console.log('V35.23.6 remediation safeguards: PASS');
