import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const must=(condition,message)=>{
  if(!condition){
    console.error('FAIL:',message);
    process.exitCode=1;
  }else{
    console.log('PASS:',message);
  }
};

const worker=read('src/worker.js');
const script=read('public/script.js');
const html=read('public/bc10000/index.html');
const styles=read('public/styles.css');
const contact=read('public/contact.html');
const homepage=read('public/index.html');
const master=read('public/elfa-master/index.html');
const elfaPro=read('public/elfa-pro/index.html');
const elfaPods=[
  read('public/elfa-pro/peach-ice.html'),
  read('public/elfa-pro/spearmint.html'),
  read('public/elfa-pro/miami-mint.html'),
  read('public/elfa-pro/grape.html'),
  read('public/elfa-pro/watermelon.html')
];
const elfbar=read('public/elfbar/index.html');
const owner=read('public/owner.html');
const ownerJs=read('public/owner.js');
const productStatus=read('public/product-status.js');
const pkg=JSON.parse(read('package.json'));

must(worker.includes('expectedRetailPrice: 220') && worker.includes('expectedRetailPrice: 120') && worker.includes('unitPrice: 220') && worker.includes('unitPrice: 120'),'Worker ELFA prices are R220 and R120');

must(worker.includes('var PRODUCT_PRICE_ZAR = 300;'),'BC10000 backend price remains R300');

must(worker.includes('getWebsitePriceOverrides') && worker.includes('vestige-product-pricing'),'Worker reads website price overrides from D1');

must(worker.includes('admin_product_price_status') && worker.includes('admin_preview_product_price_sync') && worker.includes('admin_apply_product_price_sync'),'Owner pricing API exposes status, preview and guarded apply actions');

must(worker.includes('SYNC ELFA PRICES') && worker.includes('all variants must have the same Zoho Books selling rate'),'Price sync requires consistent Zoho rates and explicit confirmation');

must(worker.includes('Zoho item price does not match R'),'Checkout and public catalogue block Zoho price mismatches');

[
  'bc10000:blueberry-mint',
  'bc10000:miami-mint',
  'bc10000:blue-razz-ice',
  'bc10000:strawberry-kiwi-ice',
  'bc10000:watermelon-ice',
  'elfa-master:dark-cosmo',
  'elfa-master:dusty-pink',
  'elfa-master:black-knight',
  'elfa-pro:grape',
  'elfa-pro:peach-ice',
  'elfa-pro:watermelon',
  'elfa-pro:miami-mint',
  'elfa-pro:spearmint'
].forEach(k=>must(
  worker.includes(k),
  'Worker checkout catalogue contains '+k
));

must(
  worker.includes('getPublicInventoryCatalogue'),
  'Worker exposes full public inventory catalogue'
);

must(
  worker.includes('catalogue, verifiedAt'),
  'Availability response includes catalogue'
);

must(
  worker.includes('DELIVERY_PRICE_ZAR = 60'),
  'Courier fee remains R60'
);

must(
  worker.includes('DELIVERY_METHOD_COLLECTION'),
  'Collection workflow remains present'
);

must(
  script.includes("var DELIVERY_PRICE=60, API_URL='/api/zoho', availability={}, catalogue={}"),
  'Frontend maintains separate BC availability + full catalogue'
);

must(
  script.includes("productKey:'elfa-master:dark-cosmo'"),
  'Frontend maps ELFA MASTER product keys'
);

must(
  script.includes("productKey:'elfa-pro:grape'"),
  'Frontend maps ELFA PRO product keys'
);

must(
  script.includes("items:cart.map(function(x){return {productKey:x.productKey,itemId:x.itemId,quantity:x.quantity};})"),
  'Checkout submits productKey/itemId/quantity'
);

must(
  script.includes("function cartProductsTotal(){return cart.reduce"),
  'Basket total is line-price based'
);

must(
  !script.includes('cartQuantity()*PRODUCT_PRICE'),
  'No hard-coded R300 basket total remains'
);

must(
  !script.includes('coming soon. Ordering will open'),
  'ELFA MASTER is no longer artificially blocked'
);

must(
  script.includes("vestigeBasketV2"),
  'Basket persistence schema bumped for multi-product carts'
);

must(
  html.includes('<option value="ELFA_MASTER">ELFA MASTER — R220.00</option>'),
  'ELFA MASTER is selectable in shop at R220'
);

must(
  html.includes('<option value="ELFA_PRO">ELFA PRO — R120.00 · 2-pod pack</option>'),
  'ELFA PRO is selectable in shop at R120'
);

must(
  html.includes('/script.js?v=35.34.27'),
  'Shop loads the V35.34.27 checkout script reference'
);

must(
  html.includes('/assets/elfbar-introducing-logo.png'),
  'Approved W1 ELFBAR artwork retained'
);

must(
  html.includes('/assets/bc10000-technical-approved.jpg') ||
  html.includes('/assets/bc10000-approved-white.png'),
  'Approved W1 BC10000 artwork retained'
);

must(
  pkg.version==='35.34.28',
  'Package version is 35.34.28'
);

/* V35.34.25 final presentation refinements */

must(
  styles.includes('/* V35.34.25 — Final contact and specialist retail textbox spacing refinements.'),
  'V35.34.25 final presentation refinement marker retained'
);

must(
  styles.includes('.contact-grid-two .contact-action-stack .btn{\n  width:158px;'),
  'Contact e-mail and Instagram buttons use the approved 158px width'
);

must(
  styles.includes('.corporate-home .vapes-action-buttons{\n  display:grid;\n  grid-template-columns:minmax(0,2fr) minmax(170px,1fr);\n  gap:10px;'),
  'Specialist retail buttons retain the approved 10px gap'
);

must(
  styles.includes('  margin-bottom:6px;\n}\n.corporate-home .vapes-action-buttons .btn{'),
  'Specialist retail buttons retain the approved 6px bottom spacing'
);

must(
  contact.includes('styles.css?v=35.34.25'),
  'Contact page loads V35.34.25 stylesheet cache'
);

must(
  homepage.includes('/styles.css?v=35.34.25'),
  'Homepage loads V35.34.25 stylesheet cache'
);

must(
  styles.includes('V35.34.26'),
  'V35.34.26 shop button refinement marker retained'
);
must(
  styles.includes('#addToBasket{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:46px!important;background:#0b2742!important;color:#fff!important;border:1px solid #0b2742!important;'),
  'Shop Add to Basket button uses the approved website blue'
);
must(
  html.includes('/styles.css?v=35.34.26'),
  'Shop page loads the V35.34.26 stylesheet cache'
);
must(
  master.includes('data-product-price-family="ELFA MASTER">R220.00') &&
  master.includes('data-product-price-family="ELFA PRO">R120.00'),
  'ELFA MASTER page shows R220 and ELFA PRO cross-sell shows R120'
);

must(
  master.includes('data-stock-product-key="elfa-master:dark-cosmo"') &&
  master.includes('data-stock-product-key="elfa-master:dusty-pink"') &&
  master.includes('data-stock-product-key="elfa-master:black-knight"') &&
  !master.includes('Sale activation will follow'),
  'ELFA MASTER finishes use live availability messaging'
);

must(
  elfaPro.includes('data-product-price-family="ELFA PRO">R120.00') &&
  !elfaPro.includes('R150.00'),
  'ELFA PRO range page shows R120 across its price references'
);

must(
  elfaPods.every(page=>page.includes('product-status.js?v=35.34.27') && page.includes('data-stock-product-key=') && !page.includes('R150.00')),
  'All five ELFA PRO detail pages show R120 and live availability'
);

must(
  elfbar.includes('data-product-price-family="ELFA MASTER">R220.00') &&
  !elfbar.includes('R250.00'),
  'ELFBAR landing page shows the revised ELFA MASTER price'
);

must(
  html.includes('BC10000 — R300.00') &&
  worker.includes('var PRODUCT_PRICE_ZAR = 300;'),
  'BC10000 public and backend price remain R300'
);

must(
  owner.includes('id="productPricingPanel"') &&
  ownerJs.includes('admin_product_price_status') &&
  ownerJs.includes('admin_preview_product_price_sync') &&
  ownerJs.includes('admin_apply_product_price_sync'),
  'Owner Console includes guarded Zoho price management'
);

must(
  productStatus.includes("body:JSON.stringify({action:'availability'})") &&
  productStatus.includes('data-product-price-family') &&
  productStatus.includes('data-stock-product-key'),
  'Public ELFA pages refresh price and stock status from the Worker catalogue'
);

must(
  contact.includes('contact-whatsapp-qr-link') &&
  contact.includes('Open WhatsApp QR full size'),
  'WhatsApp QR opens at full size from the contact page'
);

must(
  owner.includes('SYNC ELFA PRICES'),
  'Owner price sync requires the explicit confirmation phrase'
);

if(process.exitCode){
  console.error('\nV35.34.28 verification FAILED.');
  process.exit(process.exitCode);
}

console.log('\nV35.34.28 verification PASSED.');