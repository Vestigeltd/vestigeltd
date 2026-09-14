const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'src', 'worker.js'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public', 'script.js'), 'utf8');

assert.match(worker, /'product_selection_completed'/,
  'The Worker must accept the completed-selection analytics event.');
assert.match(script, /vestigeTrackConversion\('product_selection_completed'/,
  'Completed-selection tracking must use the shared session-aware analytics sender.');

const conversionLayer = script.split('V35_13_0_SHOP_CONVERSION_OPTIMIZATION')[1] || '';
assert.doesNotMatch(conversionLayer, /fetch\('\/api\/analytics'/,
  'The conversion layer must not bypass the shared analytics sender.');

console.log('V35.23.3 analytics contract safeguards passed.');
