'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const home=read('public/index.html');
assert(home.includes('<title>Vestige | Considered Specialist Retail in South Africa</title>'));
assert(home.includes('name="description" content="Discover Vestige, a considered specialist retail brand built on curation, clarity, precision and professional service in South Africa."'));
assert(home.includes('"@type": "Organization"'));
assert(home.includes('"@type": "WebPage"'));
assert(home.includes('"dateModified": "2026-09-11"'));

const hub=read('public/bc10000/index.html');
assert(hub.includes('name="description"'));
assert(hub.includes('"@type":"BreadcrumbList"'));
assert(hub.includes('"dateModified":"2026-09-11"'));
assert(hub.includes('"@type":"Product"'));

const local=read('public/vape-durbanville.html');
assert(local.includes('name="description"'));
assert(local.includes('"@type":"BreadcrumbList"'));
assert(local.includes('"dateModified":"2026-09-11"'));
assert(!local.includes('"@type":"LocalBusiness"'));

for(const slug of ['blueberry-mint','miami-mint','blue-razz-ice','strawberry-kiwi-ice','watermelon-ice']){
 const html=read(`public/flavours/${slug}.html`);
 const blocks=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 assert.equal(blocks[0]['@type'],'Product');
 assert.equal(blocks[1]['@type'],'BreadcrumbList');
 assert.equal(blocks[2]['@type'],'WebPage');
 assert.equal(blocks[2].dateModified,'2026-09-11');
 assert(html.includes('max-snippet:-1'));
}

const sitemap=read('public/sitemap.xml');
for(const url of ['https://vestigeltd.co.za/','https://vestigeltd.co.za/bc10000/','https://vestigeltd.co.za/vape-durbanville','https://vestigeltd.co.za/flavours/blueberry-mint']){
 assert(sitemap.includes(`<loc>${url}</loc>`),`Missing sitemap URL: ${url}`);
}
console.log('V35.27.7 enhanced SEO safeguards: PASS');
