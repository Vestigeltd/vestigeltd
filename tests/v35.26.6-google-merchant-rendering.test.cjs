const fs = require('fs');
const assert = require('assert');
const worker = fs.readFileSync('src/worker.js','utf8');

assert.match(worker, /availabilityUrl\(stock\)/, 'Worker must dynamically derive availability.');
assert.match(worker, /offer\.availability\s*=\s*availabilityUrl\(stock\)/, 'Worker must overwrite fallback availability from live sellable stock.');
assert.match(worker, /handlingTime:\s*\{[^}]*minValue:\s*0,[^}]*maxValue:\s*1,[^}]*unitCode:\s*'DAY'/, 'Worker shipping data must preserve a maximum 24-hour handling period.');
assert.match(worker, /transitTime:\s*\{[^}]*minValue:\s*1,[^}]*maxValue:\s*5,[^}]*unitCode:\s*'DAY'/, 'Worker shipping data must keep maximum delivery at 6 days including handling.');
assert.match(worker, /X-Vestige-Merchant-Data', 'v35\.26\.7'/, 'Merchant enrichment version header must identify V35.26.7.');

const files = ['public/bc10000/index.html','public/flavours/blueberry-mint.html','public/flavours/miami-mint.html','public/flavours/blue-razz-ice.html','public/flavours/strawberry-kiwi-ice.html','public/flavours/watermelon-ice.html'];
for (const file of files) {
  const html=fs.readFileSync(file,'utf8');
  assert.match(html,/"availability":"https:\/\/schema\.org\/OutOfStock"/, `${file} must provide a conservative initial availability fallback.`);
  assert.match(html,/"deliveryTime":\{"@type":"ShippingDeliveryTime","handlingTime":\{"@type":"QuantitativeValue","minValue":0,"maxValue":1,"unitCode":"DAY"\},"transitTime":\{"@type":"QuantitativeValue","minValue":1,"maxValue":5,"unitCode":"DAY"\}\}/, `${file} must expose 24-hour handling and keep maximum delivery at 6 days.`);
  assert.match(html,/"hasMerchantReturnPolicy":\{"@type":"MerchantReturnPolicy"/, `${file} must preserve return policy.`);
}
console.log('V35.26.6 Google merchant rendering checks passed.');
