const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const firstJsonLd = html => {
  const m = html.match(/<script type="application\/ld\+json">\s*({.*?})<\/script>/s);
  assert(m, 'JSON-LD block missing');
  return JSON.parse(m[1]);
};

const graph = firstJsonLd(read('public/bc10000/index.html'))['@graph'];
const store = graph.find(x => x['@id'] === 'https://vestigeltd.co.za/#organization');
assert(store, 'merchant entity missing');
assert.equal(store['@type'], 'OnlineStore');
assert.equal(store.name, 'Vestige Vapes');
assert.equal(store.legalName, 'Vestige Ltd');
assert.equal(store.url, 'https://vestigeltd.co.za/');
assert.equal(store.contactPoint.email, 'contact@vestigeltd.co.za');
assert.equal(store.hasShippingService['@type'], 'ShippingService');
assert.equal(store.hasShippingService['@id'], 'https://vestigeltd.co.za/#locker-delivery');
assert.equal(store.hasShippingService.fulfillmentType, 'https://schema.org/FulfillmentTypeCollectionPoint');
assert.deepEqual(store.hasShippingService.handlingTime.duration, {'@type':'QuantitativeValue',minValue:0,maxValue:1,unitCode:'DAY'});
assert.equal(store.hasShippingService.shippingConditions.shippingDestination.addressCountry, 'ZA');
assert.equal(store.hasShippingService.shippingConditions.shippingRate.value, '60.00');
assert.equal(store.hasShippingService.shippingConditions.shippingRate.currency, 'ZAR');
assert.deepEqual(store.hasShippingService.shippingConditions.transitTime.duration, {'@type':'QuantitativeValue',minValue:1,maxValue:5,unitCode:'DAY'});
assert.equal(store.hasMerchantReturnPolicy['@id'], 'https://vestigeltd.co.za/#returns-policy');
assert.equal(store.hasMerchantReturnPolicy.merchantReturnLink, 'https://vestigeltd.co.za/returns-refunds');
assert.equal(store.hasMerchantReturnPolicy.merchantReturnDays, 7);
assert.equal(store.hasMerchantReturnPolicy.returnFees, 'https://schema.org/ReturnFeesCustomerResponsibility');

for (const file of fs.readdirSync(path.join(root,'public/flavours')).filter(f => f.endsWith('.html'))) {
  const product = firstJsonLd(read(`public/flavours/${file}`));
  assert.equal(product['@type'], 'Product');
  const offer = product.offers;
  assert.equal(offer.seller['@id'], 'https://vestigeltd.co.za/#organization');
  // Proven V35.26.7 offer-level fields are deliberately retained as a no-regression fallback.
  assert.equal(offer.shippingDetails['@type'], 'OfferShippingDetails');
  assert.equal(offer.shippingDetails.shippingRate.value, '60.00');
  assert(offer.shippingDetails.deliveryTime.handlingTime, `${file}: handlingTime missing`);
  assert.equal(offer.hasMerchantReturnPolicy['@type'], 'MerchantReturnPolicy');
  assert(offer.availability, `${file}: availability fallback missing`);
  assert(product.gtin13 && product.mpn && product.sku && product.model, `${file}: product identifiers regressed`);
}
console.log('V35.26.8 merchant entity checks passed.');
