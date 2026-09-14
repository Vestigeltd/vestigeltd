'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const worker=fs.readFileSync(path.join(root,'src','worker.js'),'utf8');
const script=fs.readFileSync(path.join(root,'public','script.js'),'utf8');
const payment=fs.readFileSync(path.join(root,'public','payment-visibility.css'),'utf8');
const sitemap=fs.readFileSync(path.join(root,'public','sitemap.xml'),'utf8');

assert.match(worker,/V35_26_0_EXTENSIONLESS_PUBLIC_ROUTE_MAP/);
for (const [route,asset] of [['/contact','/contact.html'],['/privacy-policy','/privacy-policy.html'],['/terms-and-conditions','/terms-and-conditions.html'],['/returns-refunds','/returns-refunds.html']]) {
  assert(worker.includes(`'${route}': '${asset}'`), `${route} explicit asset route missing`);
  assert(sitemap.includes(`<loc>https://vestigeltd.co.za${route}</loc>`), `${route} sitemap entry missing`);
}
assert(worker.includes("url.pathname === '/contact.html'"));
assert(worker.includes("url.pathname === '/privacy-policy.html'"));
assert(worker.includes("url.pathname === '/terms-and-conditions.html'"));
assert(worker.includes("url.pathname === '/returns-refunds.html'"));
assert.match(script,/payment-visibility\.css\?v=35\.22\.0&release=35\.26\.1/);
assert.match(payment,/html\.vestige-payment-open \.site-header \{[\s\S]*?background: #06101d !important;[\s\S]*?height: 86px;/);
assert.match(payment,/html\.vestige-payment-open #vestigeCheckoutJourney,[\s\S]*?display: none !important;/);
assert.match(payment,/html\.vestige-payment-open #vestigeCheckoutGuidance \{[\s\S]*?visibility: hidden !important;/);
assert(fs.existsSync(path.join(root,'public','google-analytics.js')));
assert(worker.includes('https://www.googletagmanager.com'));

const expected={
 'blueberry-mint':['6941976230678','ELFG02','vestige-bc10000-blueberry-mint'],
 'miami-mint':['6941976230487','ELFG05','vestige-bc10000-miami-mint'],
 'blue-razz-ice':['6941976230661','ELFG01','vestige-bc10000-blue-razz-ice'],
 'strawberry-kiwi-ice':['6941976230760','ELFG03','vestige-bc10000-strawberry-kiwi-ice'],
 'watermelon-ice':['6941976230531','ELFG04','vestige-bc10000-watermelon-ice']
};
for (const [slug,[gtin,mpn,sku]] of Object.entries(expected)) {
 const html=fs.readFileSync(path.join(root,'public','flavours',slug+'.html'),'utf8');
 const m=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 assert(m, `${slug} product JSON-LD missing`);
 const data=JSON.parse(m[1]);
 assert.equal(data['@type'],'Product');
 assert.equal(data.gtin13,gtin);
 assert.equal(data.mpn,mpn);
 assert.equal(data.sku,sku);
 assert.equal(data.model,'BC10000');
 assert(html.includes(`<strong>GTIN:</strong> ${gtin}`));
 assert(html.includes(`<strong>MPN:</strong> ${mpn}`));
 assert(html.includes('/google-analytics.js'));
}
const bak=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(ent.name.endsWith('.bak'))bak.push(p)}}
walk(path.join(root,'public'));
assert.deepEqual(bak,[]);
console.log('V35.26.0 optimized-baseline safeguards passed.');
