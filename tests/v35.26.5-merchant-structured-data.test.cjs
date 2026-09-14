const fs = require('fs');
const assert = require('assert');
const worker = fs.readFileSync('src/worker.js','utf8');
assert.match(worker, /injectGoogleAvailability/);
assert.match(worker, /shippingDetails/);
assert.match(worker, /hasMerchantReturnPolicy/);
assert.match(worker, /MerchantReturnFiniteReturnWindow/);
assert.match(worker, /merchantReturnDays:\s*7/);
assert.match(worker, /ReturnFeesCustomerResponsibility/);
assert.match(worker, /addressCountry:\s*'ZA'/);
assert.match(worker, /value:\s*'60\.00'/);
assert.match(worker, /pathname === '\/bc10000\/'/);
assert.match(worker, /getGoogleFacingAvailability/);
console.log('V35.26.5 merchant structured-data checks passed.');
for (const file of ['public/bc10000/index.html','public/flavours/blueberry-mint.html','public/flavours/miami-mint.html','public/flavours/blue-razz-ice.html','public/flavours/strawberry-kiwi-ice.html','public/flavours/watermelon-ice.html']) {
  const html=fs.readFileSync(file,'utf8');
  assert.match(html,/"shippingDetails":\{"@type":"OfferShippingDetails"/, `${file} needs shippingDetails`);
  assert.match(html,/"hasMerchantReturnPolicy":\{"@type":"MerchantReturnPolicy"/, `${file} needs return policy`);
}
