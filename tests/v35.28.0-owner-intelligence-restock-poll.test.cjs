'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const pkg=JSON.parse(read('package.json'));
const shop=read('public/bc10000/index.html');
const script=read('public/script.js');
const owner=read('public/owner.html');
const ownerScript=read('public/owner.js');
const worker=read('src/worker.js');
const sitemap=read('public/sitemap.xml');
const poll=(shop.match(/<form class="restock-poll"[\s\S]*?<\/form>/)||[])[0]||'';

assert.equal(pkg.version,'35.28.1');
assert.match(poll,/id="restockPoll"/);
assert.equal((poll.match(/type="checkbox" value="/g)||[]).length,13,'Poll must expose 13 substantiated BC10000 flavour choices.');
assert.doesNotMatch(poll,/type="(?:email|tel|text)"/,'Poll must not request customer details.');
assert.match(script,/JSON\.stringify\(\{action:'vote',selections\}\)/,'Poll must submit every checked selection as one aggregate vote.');
assert.match(script,/localStorage\.setItem\(submittedKey,'1'\)/,'Browser-local duplicate deterrent is missing.');

assert.ok(owner.indexOf('id="conversionAnalyticsCard"')<owner.indexOf('</div>\n</main>'),'Business intelligence must remain inside the locked console panel.');
for(const id of ['analyticsVisitors','analyticsPageViews','analyticsShopViews','analyticsProductSelections','analyticsBaskets','analyticsCheckoutStarts','analyticsPaymentClaims','analyticsConfirmedOrders','analyticsRevenue','analyticsUnitsSold','analyticsAov','analyticsConversionRate','analyticsAbandonmentRate','restockDemandList']){
  assert.ok(owner.includes(`id="${id}"`),`Owner intelligence field missing: ${id}`);
}
for(const period of ['today','7','30'])assert.ok(owner.includes(`data-analytics-period="${period}"`),`Analytics period missing: ${period}`);
assert.match(ownerScript,/fetch\('\/api\/restock-poll'/);
assert.match(ownerScript,/body:JSON\.stringify\(\{action:'admin_summary'\}\)/);

assert.match(worker,/const VESTIGE_RESTOCK_NAMESPACE = 'vestige-restock-demand'/);
assert.match(worker,/url\.pathname === '\/api\/restock-poll'/);
assert.match(worker,/raw IP addresses or user agents/);
assert.match(worker,/pathname === '\/owner' \|\| pathname === '\/owner\.html'/);
assert.match(worker,/url\.pathname === '\/bc10000\/index\.html'/);
assert.doesNotMatch(sitemap,/\/owner/,'Owner route must not appear in sitemap.');
assert.match(sitemap,/<loc>https:\/\/vestigeltd\.co\.za\/bc10000\/<\/loc>[\s\S]{0,80}<lastmod>2026-09-14<\/lastmod>/);

console.log('V35.28.0 owner intelligence and restock poll safeguards: PASS');
