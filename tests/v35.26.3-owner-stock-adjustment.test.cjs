'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public','owner.html'),'utf8');
const js=fs.readFileSync(path.join(root,'public','owner.js'),'utf8');
const api=fs.readFileSync(path.join(root,'src','zoho-integration.cjs'),'utf8');

assert.match(html,/STOCK OPERATIONS/);
assert.match(html,/Stock Adjustment/);
assert.match(html,/Tester/);
assert.match(html,/Remove from sale/);
assert.match(html,/Return to sale/);
assert.match(html,/owner\.js\?v=35\.28\.1/);
assert.match(html,/owner\.css\?v=35\.28\.1/);

assert.match(js,/admin_preview_stock_adjustment/);
assert.match(js,/admin_apply_stock_adjustment/);
assert.match(js,/previewFingerprint/);
assert.match(js,/confirmationRequired/);
assert.match(js,/Owner excluded/);

assert.match(api,/vestige-owner-stock-adjustments/);
assert.match(api,/OWNER_STOCK_ADJUSTMENT_REASONS/);
assert.match(api,/ownerExcluded/);
assert.match(api,/totalUnavailable = reserved \+ ownerExcluded/);
assert.match(api,/adminPreviewStockAdjustment/);
assert.match(api,/adminApplyStockAdjustment/);
assert.match(api,/acquireStockLock\(initial\.itemId/);
assert.match(api,/Stock-adjustment preview is stale/);
assert.match(api,/Only \$\{sellableBefore\} unit\(s\) are currently sellable/);
assert.match(api,/Only \$\{ownerExcludedBefore\} unit\(s\) are currently excluded/);
assert.match(api,/admin_stock_adjustment/);
assert.match(api,/zohoBooksChanged:false/);
assert.doesNotMatch(js,/sessionStorage\.setItem\([^\n]*admin/i);

console.log('V35.26.3 owner stock-adjustment safeguards passed.');
