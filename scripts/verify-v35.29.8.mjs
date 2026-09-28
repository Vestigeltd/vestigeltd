import fs from 'node:fs';
import crypto from 'node:crypto';

const read=(p)=>fs.readFileSync(p,'utf8');
const must=(condition,message)=>{if(!condition){console.error('FAIL:',message);process.exitCode=1;}else console.log('PASS:',message);};
const worker=read('src/worker.js');
const script=read('public/script.js');
const html=read('public/bc10000/index.html');
const pkg=JSON.parse(read('package.json'));
const workerSha=crypto.createHash('sha256').update(fs.readFileSync('src/worker.js')).digest('hex');

must(workerSha==='d104f2111947075affeb78ef99a3cabd8f5b765d7b28a5f995bdb1155e1d8693','Worker exactly matches recovered active V35.29.1 production module');
[
'bc10000:blueberry-mint','bc10000:miami-mint','bc10000:blue-razz-ice','bc10000:strawberry-kiwi-ice','bc10000:watermelon-ice',
'elfa-master:dark-cosmo','elfa-master:dusty-pink','elfa-master:black-knight',
'elfa-pro:grape','elfa-pro:peach-ice','elfa-pro:watermelon','elfa-pro:miami-mint','elfa-pro:spearmint'
].forEach(k=>must(worker.includes(k),'Worker checkout catalogue contains '+k));
must(worker.includes('getPublicInventoryCatalogue'),'Worker exposes full public inventory catalogue');
must(worker.includes('catalogue, verifiedAt'),'Availability response includes catalogue');
must(worker.includes('DELIVERY_PRICE_ZAR = 60'),'Courier fee remains R60');
must(worker.includes('DELIVERY_METHOD_COLLECTION'),'Collection workflow remains present');

must(script.includes("var DELIVERY_PRICE=60, API_URL='/api/zoho', availability={}, catalogue={}"),'Frontend maintains separate BC availability + full catalogue');
must(script.includes("productKey:'elfa-master:dark-cosmo'"),'Frontend maps ELFA MASTER product keys');
must(script.includes("productKey:'elfa-pro:grape'"),'Frontend maps ELFA PRO product keys');
must(script.includes("items:cart.map(function(x){return {productKey:x.productKey,itemId:x.itemId,quantity:x.quantity};})"),'Checkout submits productKey/itemId/quantity');
must(script.includes("function cartProductsTotal(){return cart.reduce"),'Basket total is line-price based');
must(!script.includes('cartQuantity()*PRODUCT_PRICE'),'No hard-coded R300 basket total remains');
must(!script.includes('coming soon. Ordering will open'),'ELFA MASTER is no longer artificially blocked');
must(script.includes("vestigeBasketV2"),'Basket persistence schema bumped for multi-product carts');

must(html.includes('<option value="ELFA_MASTER">ELFA MASTER — R250.00</option>'),'ELFA MASTER is selectable in shop');
must(html.includes('<option value="ELFA_PRO">ELFA PRO — R150.00 · 2-pod pack</option>'),'ELFA PRO is selectable in shop');
must(html.includes('/script.js?v=35.29.8'),'Shop loads V35.29.8 checkout script');
must(html.includes('/assets/elfbar-introducing-logo.png'),'Approved W1 ELFBAR artwork retained');
must(html.includes('/assets/bc10000-technical-approved.jpg') || html.includes('/assets/bc10000-approved-white.png'),'Approved W1 BC10000 artwork retained');

must(pkg.version==='35.29.8','package version is 35.29.8');

if(process.exitCode){console.error('\nV35.29.8 verification FAILED.');process.exit(process.exitCode);}
console.log('\nV35.29.8 verification PASSED.');
