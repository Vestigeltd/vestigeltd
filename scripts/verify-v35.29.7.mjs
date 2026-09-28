import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pub=path.join(root,'public');
const read=(p)=>fs.readFileSync(p,'utf8');
const files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else files.push(p);}}
walk(pub);

// Static file references must resolve locally.
for(const f of files.filter(f=>/\.(html|css|js)$/i.test(f))){
  const t=read(f); const refs=[];
  for(const m of t.matchAll(/(?:src|href)=["']([^"']+)["']/gi))refs.push(m[1]);
  for(const m of t.matchAll(/url\(\s*["']?([^\)"']+)/gi))refs.push(m[1]);
  for(const r of refs){
    if(!r.startsWith('/')||r.startsWith('//')||r.startsWith('/api/'))continue;
    const clean=r.split(/[?#]/)[0]; if(!path.extname(clean))continue;
    assert.ok(fs.existsSync(path.join(pub,clean.slice(1))),`${path.relative(pub,f)} references missing ${clean}`);
  }
}

const index=read(path.join(pub,'index.html'));
assert.match(index,/<a class="nav-buy" href="\/elfbar\/">ELFBAR VAPES<\/a>/);
const combined=files.filter(f=>/\.(html|js)$/i.test(f)).map(read).join('\n')+read(path.join(root,'src','worker.js'));
assert.doesNotMatch(combined,/vestige-restock-demand|restock_poll|vote for your flavour/i);
assert.doesNotMatch(combined,/static\.cloudflareinsights\.com\/beacon\.min\.js/i);

// Existing operational DOM contracts remain intact.
const ownerHtml=read(path.join(pub,'owner.html')); const ownerJs=read(path.join(pub,'owner.js'));
const ownerIds=new Set([...ownerHtml.matchAll(/id=["']([^"']+)["']/g)].map(m=>m[1]));
for(const m of ownerJs.matchAll(/getElementById\('([^']+)'\)/g)) assert.ok(ownerIds.has(m[1]),`owner.js missing DOM id ${m[1]}`);
const statusHtml=read(path.join(pub,'order-status.html')); const statusJs=read(path.join(pub,'order-status.js'));
const statusIds=new Set([...statusHtml.matchAll(/id=["']([^"']+)["']/g)].map(m=>m[1]));
for(const m of statusJs.matchAll(/getElementById\('([^']+)'\)/g)) assert.ok(statusIds.has(m[1]),`order-status.js missing DOM id ${m[1]}`);

const sitemap=read(path.join(pub,'sitemap.xml'));
for(const slug of ['blueberry-mint','miami-mint','blue-razz-ice','strawberry-kiwi-ice','watermelon-ice']){
  const html=read(path.join(pub,'flavours',slug+'.html'));
  const canonical=`https://vestigeltd.co.za/flavours/${slug}`;
  assert.ok(html.includes(`rel="canonical" href="${canonical}"`)||html.includes(`href="${canonical}" rel="canonical"`),`canonical missing ${slug}`);
  assert.ok(sitemap.includes(canonical),`sitemap missing ${slug}`);
}

const elfbar=read(path.join(pub,'elfbar','index.html'));
const master=read(path.join(pub,'elfa-master','index.html'));
const bc=read(path.join(pub,'bc10000','index.html'));
const shopJs=read(path.join(pub,'script.js'));
const css=read(path.join(pub,'styles.css'));

// Workload 1.1-1.6: contrast, spacing and product-image presentation.
assert.match(elfbar,/product-visual-surface bc-product-visual/);
assert.match(elfbar,/\/assets\/bc10000-approved-white\.png/);
assert.match(elfbar,/product-visual-surface master-product-visual/);
assert.match(elfbar,/\/assets\/elfa-master-approved-white\.png/);
assert.match(elfbar,/Stock received · activation pending/);
assert.ok(css.includes('width:calc(100% - 125px)!important'), 'desktop product-image 125px reduction rule missing');
assert.ok(css.includes('background:#ffffff;'), 'plain white product visual background missing');
assert.ok(css.includes('.brand-curated-copy-right{display:flex;flex-direction:column;justify-content:center}'), 'ELFBAR right-copy centering rule missing');

// Workload 1.7-1.9: BC10000 hero and technical profile responsiveness.
assert.match(bc,/class="hero bc10000-hero-v2"/);
assert.match(bc,/class="bc10000-hero-media"/);
assert.doesNotMatch(bc,/<div class="hero-overlay"><\/div>/);
assert.match(bc,/technical-profile-card/);
assert.match(bc,/bc10000-tech-visual/);
assert.match(bc,/\/assets\/bc10000-technical-approved\.jpg/);
assert.match(bc,/\/assets\/elfbar-introducing-logo\.png/);
assert.doesNotMatch(bc,/ELFBAR brand mark/i);
for(const v of ['85 × 43 × 22 mm','620 mAh rechargeable','18 ml','50 mg/ml','USB-C / Type-C']) assert.ok(bc.includes(v),`BC10000 technical profile missing ${v}`);

// Workload 1.10: ELFA MASTER responsive technical profile with supplied values.
assert.match(master,/technical-profile-card technical-profile-master/);
assert.match(master,/master-tech-visual/);
for(const v of ['ELFA MASTER Rechargeable Kit','50 mg/ml','9 to 18 watts','850 mAh','Stainless steel / PC','Fast Charging Function','0.8Ω, 1.1Ω, 1.2Ω pods','2ml','9 - 12 watts','12 - 18 watts','90mm × 21mm × 25mm','sold with 2 pods']) assert.ok(master.toLowerCase().includes(v.toLowerCase()),`ELFA MASTER supplied technical profile missing ${v}`);
assert.doesNotMatch(master,/master-measure-label|master-measure-height|master-measure-width|master-measure-depth/);
assert.match(master,/\/assets\/elfa-master-technical-sharp\.svg/);
const masterSharpSvg=read(path.join(pub,'assets','elfa-master-technical-sharp.svg'));
for(const v of ['90 mm','21 mm','25 mm','HEIGHT','WIDTH','DEPTH']) assert.ok(masterSharpSvg.includes(v),`ELFA MASTER sharp SVG missing ${v}`);
assert.match(masterSharpSvg,/transform="rotate\(-90 146 318\)"/);
assert.ok(css.includes('.master-tech-stage .master-tech-sharp-diagram{'), 'sharp ELFA MASTER diagram CSS missing');
assert.match(master,/master-tech-summary-dimensions/);
assert.ok(master.includes('90 × 21 × 25 mm'),'ELFA MASTER dimension summary missing');
assert.ok(master.includes('No charging cable is supplied.'),'ELFA MASTER charging cable exclusion missing');
assert.ok(masterSharpSvg.includes('x="146" y="318"'),'ELFA MASTER sharp height text placement missing');
assert.ok(css.includes('.master-tech-summary-dimensions strong{font-size:18px'),'ELFA MASTER dimension summary sizing rule missing');
assert.doesNotMatch(master,/master-table-unified|rowspan="12"/);
assert.ok(css.includes('@media(max-width:460px)') && css.includes('.technical-spec-list>div{grid-template-columns:1fr'), 'narrow-mobile technical-profile reflow rule missing');

// Workload 1.7: physical ELFA PRO pod reference visible on every detail page.
for(const [slug,sku] of [['peach-ice','ELFI06'],['spearmint','ELFI02'],['miami-mint','ELFI09'],['grape','ELFI03'],['watermelon','ELFI08']]){
  const html=read(path.join(pub,'elfa-pro',slug+'.html'));
  const canonical=`https://vestigeltd.co.za/elfa-pro/${slug}`;
  assert.ok(html.includes(`rel="canonical" href="${canonical}"`)||html.includes(`href="${canonical}" rel="canonical"`),`ELFA PRO canonical missing ${slug}`);
  assert.ok(html.includes(sku),`ELFA PRO supplier SKU missing ${slug}`);
  assert.ok(html.includes('50 mg/ml'),`ELFA PRO nicotine strength missing ${slug}`);
  assert.ok(html.includes('R150.00'),`ELFA PRO retail price missing ${slug}`);
  assert.doesNotMatch(html,/pod-detail-product-reference|elfa-pro-pods-only\.png/,`ELFA PRO detail page must not show separate pod overlay ${slug}`);
  assert.ok(!fs.existsSync(path.join(pub,'assets','elfa-pro-pods-only.png')),'retired ELFA PRO pods-only overlay asset should be removed');
  assert.ok(sitemap.includes(canonical),`ELFA PRO sitemap missing ${slug}`);
  assert.doesNotMatch(html,/priceCurrency|"price"\s*:/,`ELFA PRO must not publish checkout Offer schema before sale activation ${slug}`);
}

// Workload 1.11: immediate catalogue interaction while live stock remains authoritative.
assert.match(shopJs,/availabilityLoading=false/);
assert.match(shopJs,/flavour\.setAttribute\('data-stock-pending','true'\)/);
assert.match(shopJs,/Choose a flavour while live stock verifies with Zoho Books/);
assert.match(shopJs,/catch\(e\)\{availability=\{\};availabilityResolved=false;setShopSoldOut\(false\);Array\.prototype\.forEach\.call\(flavour\.options,function\(opt,index\)\{if\(index>0\)opt\.disabled=true;\}\);flavour\.disabled=true/);
assert.match(shopJs,/if\(!item&&availabilityLoading\)/);
assert.match(shopJs,/function updateFlavourCardStockStates/);
assert.match(shopJs,/function syncModelSelection/);
for(const flavour of ['Blueberry Mint','Miami Mint','Blue Razz Ice','Strawberry Kiwi Ice','Watermelon Ice']) assert.ok(bc.includes(`data-stock-flavour="${flavour}"`),`stock badge target missing ${flavour}`);

// Product nav remains compact and Owner remains present.
const bcNav=(bc.match(/<nav[^>]*id="mainNav"[\s\S]*?<\/nav>/)||[''])[0];
assert.equal((bcNav.match(/>Home<\/a>/g)||[]).length,1,'BC10000 nav must contain Home once');
assert.equal((bcNav.match(/<a /g)||[]).length,6,'BC10000 product nav must remain compact');
assert.match(bcNav,/>Owner<\/a>/);

// Existing fulfilment/customer-notification/owner boundaries remain wired.
const worker=read(path.join(root,'src','worker.js'));
assert.match(worker,/notifyCustomerFulfilmentOnce/,'customer fulfilment notification helper missing');
assert.match(worker,/customer-fulfilment-\$\{safeState\}/,'customer notification state idempotency key missing');
assert.match(worker,/Fulfilment saved; customer notification needs review/,'non-blocking notification failure message missing');
assert.match(worker,/Tracking reference: \$\{trackingReference\}/,'dispatch tracking email content missing');
assert.match(ownerJs,/customer_fulfilment_email:'Customer status email'/,'owner audit label for customer status email missing');
assert.match(ownerHtml,/triggers a customer status email/,'owner fulfilment notification guidance missing');

for(const forbidden of ['production-version.json','production-worker.raw','deployment-history.txt']){
  assert.ok(!files.some(f=>path.basename(f)===forbidden),`recovery artifact leaked: ${forbidden}`);
}
for(const name of ['styles.css','owner.css','order-status.css','discover.css','bank-payments.css','payment-visibility.css']){
  const s=read(path.join(pub,name)).replace(/\/\*[\s\S]*?\*\//g,'');
  assert.equal((s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length,`${name} braces unbalanced`);
}

console.log('PASS static references');
console.log('PASS operational DOM references');
console.log('PASS poll/beacon regression guards');
console.log('PASS product image replacements + centred ELFBAR copy');
console.log('PASS BC10000 review image updates + responsive technical profile');
console.log('PASS ELFA MASTER technical profile exact layout + package clarity');
console.log('PASS ELFA PRO flavour-art-only presentation');
console.log('PASS shop immediate-selection/live-stock safety');
console.log('PASS product navigation + Owner access');
console.log('PASS fulfilment/customer-notification wiring');
console.log('PASS CSS structural sanity');
