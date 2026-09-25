import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/verify-v35.29.0.mjs'], { stdio: 'inherit' });

const worker=fs.readFileSync('src/worker.js','utf8');
const owner=fs.readFileSync('public/owner.js','utf8');
const ownerHtml=fs.readFileSync('public/owner.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
function ok(condition,message){if(!condition)throw new Error('FAIL '+message);}
for(const sku of ['ELFH01','ELFH02','ELFH03','ELFI03','ELFI06','ELFI08','ELFI09','ELFI02']) ok(worker.includes(sku),'inventory SKU '+sku);
ok(worker.includes('OWNER_INVENTORY_PRODUCTS'),'owner inventory catalogue definition');
ok(worker.includes('getOwnerInventoryAvailability(true, false)'),'owner dashboard uses multi-product inventory source');
ok(worker.includes('checkoutEnabled: false'),'new ELFA items remain isolated from checkout activation');
ok(worker.includes('var ALLOWED_FLAVOURS = new Set(Object.keys(PRODUCT_NAMES));'),'BC10000 checkout allow-list remains present');
ok(owner.includes('inventory-family-cell'),'owner inventory table includes product-family presentation');
ok(owner.includes('<th>Product</th><th>Family</th><th>SKU</th>'),'owner inventory table headings');
ok(!owner.includes('All flavours are above the low-stock attention threshold.'),'legacy flavour-only owner message removed');
ok(ownerHtml.includes('BC10000 flavour'),'owner stock adjustment remains explicitly BC10000-scoped');
ok(pkg.version==='35.29.1','package version is 35.29.1');
console.log('PASS V35.29.1 multi-product owner inventory catalogue');
