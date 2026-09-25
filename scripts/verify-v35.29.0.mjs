// V35.29.1 forward-compatibility: V35.29.0 regression suite accepts only the intentional MASTER availability/package-state changes.
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
assert.match(elfbar,/BC10000/); assert.match(elfbar,/ELFA MASTER/); assert.match(elfbar,/ELFA MASTER (?:coming soon|available)/i);
assert.match(master,/850 mAh/); assert.match(master,/9–18 W/); assert.match(master,/Charging cable/); assert.match(master,/Not included/); assert.match(master,/R250\.00/);
assert.match(bc,/id="modelSelect"/); assert.match(bc,/ELFA MASTER — R250\.00 — (?:coming soon|available)/);
for(const flavour of ['Blueberry Mint','Miami Mint','Blue Razz Ice','Strawberry Kiwi Ice','Watermelon Ice']) assert.ok(bc.includes(`data-stock-flavour="${flavour}"`),`stock badge target missing ${flavour}`);
assert.match(shopJs,/function updateFlavourCardStockStates/); assert.match(shopJs,/function syncModelSelection/);
assert.ok(sitemap.includes('https://vestigeltd.co.za/elfbar/'),'ELFBAR sitemap entry missing');
assert.ok(sitemap.includes('https://vestigeltd.co.za/elfa-master/'),'ELFA MASTER sitemap entry missing');
const podIndex=read(path.join(pub,'elfa-pro','index.html'));
assert.match(podIndex,/Peach Ice/); assert.match(podIndex,/Spearmint/); assert.match(podIndex,/Miami Mint/); assert.match(podIndex,/Grape/); assert.match(podIndex,/Watermelon/);
for(const [slug,sku] of [['peach-ice','ELFI06'],['spearmint','ELFI02'],['miami-mint','ELFI09'],['grape','ELFI03'],['watermelon','ELFI08']]){
 const html=read(path.join(pub,'elfa-pro',slug+'.html'));
 const canonical=`https://vestigeltd.co.za/elfa-pro/${slug}`;
 assert.ok(html.includes(`rel="canonical" href="${canonical}"`)||html.includes(`href="${canonical}" rel="canonical"`),`ELFA PRO canonical missing ${slug}`);
 assert.ok(html.includes(sku),`ELFA PRO supplier SKU missing ${slug}`);
 assert.ok(html.includes('50 mg/ml'),`ELFA PRO nicotine strength missing ${slug}`);
 assert.ok(html.includes('R150.00'),`ELFA PRO confirmed retail price missing ${slug}`);
 assert.ok(sitemap.includes(canonical),`ELFA PRO sitemap missing ${slug}`);
 assert.doesNotMatch(html,/priceCurrency|"price"\s*:/,`ELFA PRO must not publish checkout Offer schema before sale activation ${slug}`);
}
assert.ok(sitemap.includes('https://vestigeltd.co.za/elfa-pro/'),'ELFA PRO index sitemap entry missing');
assert.doesNotMatch(master,/Incoming quantity:/,'public MASTER page must not expose incoming unit counts');
for(const sku of ['ELFH01','ELFH02','ELFH03']) assert.ok(!master.includes(sku),`public MASTER page must not expose supplier device code ${sku}`);
assert.match(master,/90 × 21 × 25 mm/); assert.match(master,/prefilled and refillable/i); assert.match(master,/Aluminium-alloy/);
assert.match(master,/id="ageGate"/); assert.match(elfbar,/id="ageGate"/); assert.match(podIndex,/id="ageGate"/);
const bcNav=(bc.match(/<nav[^>]*id="mainNav"[\s\S]*?<\/nav>/)||[''])[0];
assert.equal((bcNav.match(/>Home<\/a>/g)||[]).length,1,'BC10000 nav must contain Home once');
assert.equal((bcNav.match(/<a /g)||[]).length,6,'BC10000 product nav must remain compact');

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
console.log('PASS DOM references');
console.log('PASS V35.29.0 homepage + ELFBAR architecture');
console.log('PASS poll regression guard');
console.log('PASS Cloudflare beacon sanitation');
console.log('PASS flavour canonical + sitemap');
console.log('PASS customer fulfilment notification wiring');
console.log('PASS CSS structural sanity');

console.log('PASS ELFA MASTER product data guards');
console.log('PASS model-first shop guard');
console.log('PASS dynamic flavour stock-state hooks');
console.log('PASS ELFA PRO catalogue + canonical guards');
console.log('PASS compact product navigation');
console.log('PASS public incoming-stock privacy guard');
console.log('PASS confirmed ELFA retail pricing guards');
// Phase 4 review-led visual refinement guards
{
  const elfbar = read(path.join(pub,'elfbar','index.html'));
  const master = read(path.join(pub,'elfa-master','index.html'));
  const pro = read(path.join(pub,'elfa-pro','index.html'));
  assert(elfbar.includes('INTRODUCING ELFBAR') && elfbar.includes('Design-led from the beginning.'), 'ELFBAR introduction restoration missing');
  assert(elfbar.includes('ELFBAR · CURATED BY VESTIGE') && elfbar.includes('Two different ownership models.'), 'ELFBAR curated/model wording missing');
  assert(elfbar.includes('/assets/approved-bc10000-comparison.png') && elfbar.includes('/assets/approved-elfa-master-comparison.png'), 'approved comparison artwork missing');
  assert(master.includes('master-table-unified') && (master.includes('rowspan="12"') || master.includes('rowspan="13"')), 'unified 3-column ELFA MASTER table missing');
  assert(master.includes('Device and pods are sold separately.') || master.includes('Device supplied with 2 prefilled flavour pods.'), 'ELFA MASTER package-clarity wording missing');
  assert(!master.includes("Wicked Imports' product description does not state"), 'internal supplier-analysis copy leaked into public page');
  for (const asset of ['peach-ice','spearmint','miami-mint','grape','watermelon']) {
    assert(pro.includes(`/assets/elfa-pro-${asset}.webp`), `ELFA PRO ${asset} card art missing`);
    const detail = read(path.join(pub,'elfa-pro',`${asset}.html`));
    assert(detail.includes('pod-flavour-profile') && detail.includes('taste-meter'), `${asset} flavour profile scale missing`);
  }
  console.log('PASS Phase 4 review refinements');
}

// Phase 5 review amendments guards
{
  const elfbar = read(path.join(pub,'elfbar','index.html'));
  const master = read(path.join(pub,'elfa-master','index.html'));
  const css = read(path.join(pub,'styles.css'));
  assert(elfbar.includes('choice-lead') && elfbar.includes('Vestige keeps the choice clear:</strong><br>The'), 'choice-clear line break missing');
  assert(css.includes('.brand-logo-primary{width:100%;max-width:none'), 'ELFBAR framed-logo equal-side-spacing rule missing');
  assert(css.includes('.model-card-media .bc-model-product') && css.includes('brightness(1.015)'), 'BC10000 clarity treatment missing');
  assert(!css.includes('.model-card:first-child .model-card-media.model-media-white::after'), 'obsolete BC10000 masking overlay must be removed');
  assert(css.includes('.model-card-media.master-media .master-model-product') && css.includes('translateY(30px)'), 'ELFA MASTER exact lower alignment refinement missing');
  assert(master.includes('master-measure-row') && master.includes('21 mm') && master.includes('25 mm'), 'clean top measurement boxes missing');
  assert(master.includes('master-height-badge') && master.includes('90 mm'), 'clean 90 mm height badge missing');
  assert(master.includes('master-quick-specs') && master.includes('90 × 21 × 25 mm'), 'expanded dimension box missing');
  assert.ok(fs.existsSync(path.join(pub,'assets','elfa-pro-incoming-range.webp')), 'ELFA PRO incoming-range asset missing');
  console.log('PASS Phase 5 review amendments');
}

// Phase 6 exact Preview Candidate 3 amendment guards
{
  const elfbar = read(path.join(pub,'elfbar','index.html'));
  const master = read(path.join(pub,'elfa-master','index.html'));
  const pro = read(path.join(pub,'elfa-pro','index.html'));
  const css = read(path.join(pub,'styles.css'));
  assert(!master.includes('/assets/elfa-pro-incoming-range.webp'), 'ELFA PRO range image must not remain in ELFA MASTER text-only compatibility box');
  assert(pro.includes('pod-range-product-image') && pro.includes('/assets/elfa-pro-incoming-range.webp'), 'ELFA PRO supplied range image must be on the dedicated ELFA PRO flavour page');
  assert(!elfbar.includes('class="model-brand-mark"'), 'comparison cards must not use duplicated overlay ELFBAR logos');
  assert(elfbar.includes('/assets/approved-elfa-master-comparison.png'), 'approved ELFA MASTER comparison artwork missing');
  assert(!css.includes('model-media-white::before'), 'obsolete logo-cover mask must be removed');
  assert(css.includes('.pod-range-summary-image') && css.includes('.pod-range-product-image'), 'ELFA PRO page image presentation rules missing');
  console.log('PASS Phase 6 exact amendment placement and alignment');
}

// Phase 8 approved comparison-card artwork guards
{
  const crypto = await import('node:crypto');
  const elfbar = read(path.join(pub,'elfbar','index.html'));
  const css = read(path.join(pub,'styles.css'));
  assert(!elfbar.includes('class="model-brand-mark"'), 'comparison cards must not use duplicated overlay ELFBAR logos');
  assert(elfbar.includes('/assets/approved-bc10000-comparison.png'), 'approved BC10000 comparison artwork missing');
  assert(elfbar.includes('/assets/approved-elfa-master-comparison.png'), 'approved ELFA MASTER comparison artwork missing');
  assert(elfbar.includes('width="1122" height="1402"'), 'approved comparison media must preserve 1122x1402 geometry');
  assert(elfbar.includes('aria-label="ELFBAR BC10000 available"'), 'BC10000 comparison accessibility status missing');
  assert(elfbar.includes('aria-label="ELFA MASTER coming soon"') || elfbar.includes('aria-label="ELFA MASTER available"'), 'ELFA MASTER comparison accessibility status missing');
  assert(!elfbar.includes('<span class="model-status">AVAILABLE</span>'), 'duplicate HTML AVAILABLE badge must not overlay approved artwork');
  assert(!elfbar.includes('<span class="model-status coming">COMING SOON</span>'), 'duplicate HTML COMING SOON badge must not overlay approved artwork');
  assert(css.includes('V35.29.0 Phase 8 — approved comparison-card artwork lock'), 'Phase 8 approved artwork lock CSS missing');
  assert(css.includes('aspect-ratio:1122 / 1402') && css.includes('transform:none!important') && css.includes('filter:none!important'), 'approved comparison artwork must render without cropping, shifting or filtering');
  const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(sha(path.join(pub,'assets','approved-bc10000-comparison.png')), 'e9f7c1ca4efcba186a83fbc445cfd1ae4faa953f67e27ac5698debf686bcd0c3', 'approved BC10000 artwork hash changed');
  assert.equal(sha(path.join(pub,'assets','approved-elfa-master-comparison.png')), '28da1f40f5fa11e2e5ad213bde6ff5ac39b05b884d7b1cb21080eafcac580eef', 'approved ELFA MASTER artwork hash changed');
  console.log('PASS Phase 8 approved comparison artwork lock');
}
