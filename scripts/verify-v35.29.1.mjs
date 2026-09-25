import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root=process.cwd();
const pub=path.join(root,'public');
const read=(p)=>fs.readFileSync(p,'utf8');

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

// V35.29.1 Phase 2A customer-facing availability guards
{
  const styles = read(path.join(pub,'styles.css'));
  const elfbar = read(path.join(pub,'elfbar','index.html'));
  const master = read(path.join(pub,'elfa-master','index.html'));
  const pro = read(path.join(pub,'elfa-pro','index.html'));
  const worker = read(path.join(root,'src','worker.js'));

  assert.ok(styles.includes('white comparison-card fact contrast'),'comparison-card fact contrast marker missing');
  assert.match(styles,/\.model-grid-v2 \.model-card \.model-facts dd\{color:#172231/);

  assert.match(elfbar,/aria-label="ELFA MASTER available"/);
  assert.match(elfbar,/Current Vestige status<\/dt><dd>Available/);
  assert.match(elfbar,/Available at Vestige/);

  assert.ok(master.includes('NOW IN STOCK AT VESTIGE'),'ELFA MASTER in-stock banner missing');
  assert.match(master,/Device supplied with 2 prefilled flavour pods\./);
  assert.match(master,/starter kit with device \+ 2 prefilled flavour pods/);
  assert.doesNotMatch(master,/Device and pods are sold separately\./);

  assert.match(pro,/Five stocked flavour options/);
  assert.equal((pro.match(/<span class="pod-status">AVAILABLE<\/span>/g)||[]).length,5);

  for (const slug of ['peach-ice','spearmint','miami-mint','grape','watermelon']) {
    const detail = read(path.join(pub,'elfa-pro',slug+'.html'));
    assert.match(detail,/Vestige status<\/dt><dd>Available/,`${slug} available status missing`);
    assert.ok(detail.includes('AVAILABLE') && detail.includes('R150.00'),`${slug} available price guard missing`);
  }

  assert.match(worker,/async function getPublicInventoryCatalogue/);
  assert.match(worker,/getPublicInventoryCatalogue\(false, false\)/);
  assert.match(worker,/checkoutEnabled: spec\.checkoutEnabled === true/);
  assert.match(worker,/var PRODUCT_PRICE_ZAR = 300/,'BC10000 checkout price guard unexpectedly changed');
  assert.match(worker,/if \(!ALLOWED_FLAVOURS\.has\(flavour\)\)/,'BC10000 checkout allow-list guard unexpectedly changed');

  console.log('PASS V35.29.1 Phase 2A verified customer availability and public catalogue');
}
