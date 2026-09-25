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
ok(worker.includes('CHECKOUT_PRODUCTS') && worker.includes('checkoutEnabled: true'),'verified ELFA catalogue is activated through the server checkout catalogue');
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


// V35.29.1 Phase 2B server-authoritative multi-product checkout guards
{
  const worker = read(path.join(root,'src','worker.js'));
  const shopJs = read(path.join(pub,'script.js'));
  const shop = read(path.join(pub,'bc10000','index.html'));
  const ownerStart = worker.indexOf('var OWNER_INVENTORY_PRODUCTS = Object.freeze({');
  const ownerEnd = worker.indexOf('var ALLOWED_ACCOUNTS_HOSTS',ownerStart);
  const ownerBlock = worker.slice(ownerStart,ownerEnd);
  assert.equal((ownerBlock.match(/checkoutEnabled: true/g)||[]).length,8,'all 8 verified ELFA inventory items must be checkout-enabled');

  const requiredKeys = [
    'bc10000:blueberry-mint','bc10000:miami-mint','bc10000:blue-razz-ice','bc10000:strawberry-kiwi-ice','bc10000:watermelon-ice',
    'elfa-master:dark-cosmo','elfa-master:dusty-pink','elfa-master:black-knight',
    'elfa-pro:grape','elfa-pro:peach-ice','elfa-pro:watermelon','elfa-pro:miami-mint','elfa-pro:spearmint'
  ];
  for (const key of requiredKeys) assert.ok(worker.includes('"' + key + '"'),`server checkout product missing ${key}`);

  assert.ok(worker.includes('unitPrice: 300') && worker.includes('unitPrice: 250') && worker.includes('unitPrice: 150'),'R300/R250/R150 server price tiers missing');
  assert.ok(worker.includes('function checkoutProductKeyFromInput'),'server productKey resolver missing');
  assert.ok(worker.includes('async function requireCheckoutStockState'),'generic checkout stock verifier missing');

  const validator = worker.slice(worker.indexOf('function validateBankCartOrder'),worker.indexOf('function splitName'));
  assert.ok(validator.includes('checkoutProductKeyFromInput(raw)'),'bank validator must resolve productKey server-side');
  assert.ok(validator.includes('unitPrice = Number(spec.unitPrice)'),'bank validator must derive unit price from server catalogue');
  assert.ok(validator.includes('productsTotal = items.reduce'),'bank validator must total per-line server prices');
  assert.ok(!validator.includes('totalQuantity * PRODUCT_PRICE_ZAR'),'bank validator must not use fixed BC10000 pricing');

  const bankInvoice = worker.slice(worker.indexOf('function assertBankInvoiceMatches'),worker.indexOf('function emailPaidBankInvoice'));
  assert.ok(bankInvoice.includes('rate: Number(line.unitPrice)'),'bank invoice recovery must validate each server line price');
  assert.ok(bankInvoice.includes('rate: Number(line.unitPrice),'),'Zoho bank invoice creation must use each server line price');
  assert.ok(!bankInvoice.includes('rate: PRODUCT_PRICE_ZAR'),'bank invoice path must not force R300');

  const prepare = worker.slice(worker.indexOf('async function prepareBankOrder'),worker.indexOf('function signCheckout'));
  assert.ok((prepare.match(/requireCheckoutStockState\(line\)/g)||[]).length>=2,'prepare-bank-order must use generic stock verification before and after locks');

  const confirm = worker.slice(worker.indexOf('async function confirmBankPaymentManually'),worker.indexOf('function moneyForError'));
  assert.ok(confirm.includes('requireCheckoutStockState(line)'),'manual bank confirmation must re-verify generic product stock');

  assert.ok(shop.includes('value="ELFA_MASTER"') && shop.includes('value="ELFA_PRO"'),'shop must expose MASTER and PRO models');
  assert.ok(shop.includes('R300.00 — available') && shop.includes('R250.00 — available') && shop.includes('R150.00 — available'),'shop model prices/status missing');
  assert.ok(shopJs.includes("catalogue={}"),'client live product catalogue state missing');
  assert.ok(shopJs.includes('productKey:x.productKey'),'client checkout payload must send productKey, not a client price');
  assert.ok(shopJs.includes('Number(item.unitPrice||0)'),'client mixed-price basket math missing');
  assert.ok(!shopJs.includes('cartQuantity()*PRODUCT_PRICE'),'client basket must not use fixed R300');
  assert.ok(shopJs.includes('Number(x.unitPrice||0)'),'payment summary must use server-returned line prices');

  console.log('PASS V35.29.1 Phase 2B server-authoritative multi-product checkout');
}


// V35.29.1 Phase 2B regex/runtime-input integrity guards
{
  const worker = read(path.join(root,'src','worker.js'));
  const shopJs = read(path.join(pub,'script.js'));
  const validator = worker.slice(worker.indexOf('function validateBankCartOrder'),worker.indexOf('function splitName'));
  const stockGuard = worker.slice(worker.indexOf('async function requireCheckoutStockState'),worker.indexOf('async function findCustomerByEmail'));

  assert.ok(validator.includes(String.raw`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`),'bank checkout email regex must accept normal email syntax');
  assert.ok(validator.includes(String.raw`/^[+()\d\s.-]{7,50}$/`),'bank checkout mobile regex must use digit/whitespace character classes');
  assert.ok(validator.includes(String.raw`/^\d+$/`),'bank checkout Zoho item ID must use numeric regex');
  assert.ok((stockGuard.split(String.raw`/^\d+$/`).length-1)>=2,'generic ELFA item-ID guards must use numeric regex');
  assert.ok(shopJs.includes(String.raw`'"':'&quot;'`),'client esc() must retain a complete &quot; entity');

  console.log('PASS V35.29.1 Phase 2B regex/runtime-input integrity');
}


// V35.29.1 Phase 2C premium basket + InnoGate guards
{
  const shopJs = read(path.join(pub,'script.js'));
  const styles = read(path.join(pub,'styles.css'));
  const shop = read(path.join(pub,'bc10000','index.html'));
  const master = read(path.join(pub,'elfa-master','index.html'));
  const worker = read(path.join(root,'src','worker.js'));

  assert.ok(shopJs.includes("function basketPresentation(item)"),'premium basket presentation helper missing');
  assert.ok(shopJs.includes("ELFBAR BC10000") && shopJs.includes("ELFA MASTER · ") && shopJs.includes("ELFA PRO 2-pod pack"),'basket product labels missing');
  for (const heading of ['Product','Flavour','Quantity','Cost','Delivery / Collection','Total Amount']) {
    assert.ok(shopJs.includes(heading),`basket heading/label missing: ${heading}`);
  }
  assert.ok(shopJs.includes("MASTER_INCLUDED_PODS={'Dark Cosmo':'Miami Mint','Dusty Pink':'Peach Ice','Black Knight':'Pink Lemonade'}"),'MASTER included-pod basket mapping missing');
  assert.ok(styles.includes('V35.29.1 PHASE 2C PREMIUM MULTI-PRODUCT BASKET'),'premium basket CSS marker missing');
  assert.ok(styles.includes('.vestige-basket-table'),'premium basket table styling missing');
  assert.ok(shop.includes('/script.js?v=35.29.1.2c') && shop.includes('/styles.css?v=35.29.1.2c'),'shop Phase 2C cache keys missing');

  assert.ok(shopJs.includes("function currentDeliveryPrice(){return selectedDeliveryMethod()==='collection'?0:DELIVERY_PRICE;}"),'client collection/courier fee rule changed');
  assert.ok(shopJs.includes('function cartGrandTotal(){return cart.length?cartProductsTotal()+currentDeliveryPrice():0;}'),'client must add one fulfilment charge to the whole basket');
  const validator = worker.slice(worker.indexOf('function validateBankCartOrder'),worker.indexOf('function splitName'));
  assert.ok(validator.includes('const productsTotal = items.reduce'),'server mixed-product total missing');
  assert.ok(validator.includes('const amount = productsTotal + deliveryCharge'),'server must add one delivery charge per order, not per item');

  assert.ok(master.includes('ELFA MASTER + InnoGate App.'),'MASTER InnoGate section missing');
  assert.ok(master.includes('Bluetooth · InnoGate App'),'MASTER technical Bluetooth row missing');
  for (const capability of ['Usage insights','SmartSensation','Battery optimisation','OTA updates','Connected range']) {
    assert.ok(master.includes(capability),`MASTER InnoGate capability missing: ${capability}`);
  }
  assert.ok(master.includes('up to 25%'),'MASTER smart battery-saving manufacturer figure missing');
  assert.ok(master.includes('up to 10 metres'),'MASTER Bluetooth range manufacturer figure missing');
  assert.ok(master.includes('https://www.elfbar.com/product/elfa-master.html'),'MASTER official ELFBAR smart-feature reference missing');
  assert.ok(styles.includes('V35.29.1 PHASE 2C ELFA MASTER INNOGATE'),'MASTER InnoGate CSS marker missing');

  console.log('PASS V35.29.1 Phase 2C premium basket, one-fee fulfilment and InnoGate');
}
