const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const pages = [
  'public/bc10000/index.html',
  'public/flavours/blueberry-mint.html',
  'public/flavours/miami-mint.html',
  'public/flavours/blue-razz-ice.html',
  'public/flavours/strawberry-kiwi-ice.html',
  'public/flavours/watermelon-ice.html',
];

for (const rel of pages) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  assert(html.includes('"handlingTime":{"@type":"QuantitativeValue","minValue":0,"maxValue":1,"unitCode":"DAY"}'), `${rel}: handlingTime missing/wrong`);
  assert(html.includes('"transitTime":{"@type":"QuantitativeValue","minValue":1,"maxValue":5,"unitCode":"DAY"}'), `${rel}: transitTime missing/wrong`);
  assert(html.includes('"availability":"https://schema.org/OutOfStock"'), `${rel}: initial availability fallback missing`);
}

const worker = fs.readFileSync(path.join(root, 'src/worker.js'), 'utf8');
assert(worker.includes("handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' }"), 'worker handlingTime missing/wrong');
assert(worker.includes("transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 5, unitCode: 'DAY' }"), 'worker transitTime missing/wrong');
assert(worker.includes("return Number(stock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';"), 'dynamic availability logic changed');
console.log('V35.26.7 merchant handling-time tests passed.');
