'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const pkg=JSON.parse(read('package.json'));
assert.ok(/^35\.(27|28)\./.test(pkg.version),'Expected the V35.27/V35.28 release line.');

const wrangler=read('wrangler.toml');
assert.match(wrangler,/run_worker_first\s*=\s*\[/,'Selective Worker-first routing must be configured.');
for(const route of ['"/"','"/bc10000/*"','"/flavours/*"','"/returns-refunds.html"']) {
  assert(wrangler.includes(route),`Worker-first route missing: ${route}`);
}

const worker=read('src/worker.js');
assert.match(worker,/url\.pathname === '\/returns-refunds\.html'[\s\S]{0,140}changed = true;/,'Returns canonical redirect must set changed=true.');
assert.match(worker,/endsWith\('\.workers\.dev'\)/,'Preview hostname detection is missing.');
assert.match(worker,/X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet'/,'Preview noindex header is missing.');
assert.match(worker,/const isProductHub = pathname === '\/bc10000\/' \|\| pathname === '\/bc10000';/,'BC10000 hub must receive live availability enrichment.');
assert.doesNotMatch(worker,/const isHomepage = pathname === '\/';/,'Obsolete homepage availability lookup must not remain.');
assert.match(worker,/withSecurityHeaders\(merchantEnriched, url\.pathname, url\.hostname\)/,'Final asset response must pass hostname into security headers.');
assert.ok(worker.indexOf('const canonicalRedirect = canonicalRedirectResponse(request);') < worker.indexOf('V35_11_2A_EXTENSIONLESS_FLAVOUR_ROUTE_REPAIR'),'Canonical redirects must run before extensionless asset rewrites.');

const jsonBlocks=html=>[...html.matchAll(/<script\s+type="application\/ld\+json"\s*>\s*([\s\S]*?)\s*<\/script>/g)].map(m=>JSON.parse(m[1]));
const homeGraph=jsonBlocks(read('public/index.html')).flatMap(x=>Array.isArray(x['@graph'])?x['@graph']:[x]);
const homeWebsites=homeGraph.filter(x=>x['@type']==='WebSite');
assert.equal(homeWebsites.length,1,'Homepage must define exactly one WebSite entity.');
assert.equal(homeWebsites[0].name,'Vestige');
assert.equal(homeWebsites[0]['@id'],'https://vestigeltd.co.za/#website');

const hubGraph=jsonBlocks(read('public/bc10000/index.html')).flatMap(x=>Array.isArray(x['@graph'])?x['@graph']:[x]);
assert.equal(hubGraph.filter(x=>x['@type']==='WebSite').length,0,'BC10000 must not redeclare the domain WebSite entity.');
const hubPage=hubGraph.find(x=>x['@type']==='WebPage');
assert.equal(hubPage.isPartOf['@id'],'https://vestigeltd.co.za/#website');
assert.ok(hubGraph.find(x=>x['@type']==='Product'),'BC10000 Product entity missing.');

for(const slug of ['blueberry-mint','miami-mint','blue-razz-ice','strawberry-kiwi-ice','watermelon-ice']){
  const blocks=jsonBlocks(read(`public/flavours/${slug}.html`));
  const product=blocks.find(x=>x['@type']==='Product');
  const page=blocks.find(x=>x['@type']==='WebPage');
  const id=`https://vestigeltd.co.za/flavours/${slug}#product`;
  assert.equal(product['@id'],id,`${slug}: Product @id mismatch.`);
  assert.equal(page.mainEntity['@id'],id,`${slug}: WebPage mainEntity must resolve to Product @id.`);
}

console.log('V35.27.8 SEO hardening safeguards: PASS');
