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
assert.match(index,/<a class="nav-buy" href="\/bc10000\/">ELFBAR VAPES<\/a>/);
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
for(const forbidden of ['production-version.json','production-worker.raw','deployment-history.txt']){
 assert.ok(!files.some(f=>path.basename(f)===forbidden),`recovery artifact leaked: ${forbidden}`);
}
for(const name of ['styles.css','owner.css','order-status.css','discover.css','bank-payments.css','payment-visibility.css']){
 const s=read(path.join(pub,name)).replace(/\/\*[\s\S]*?\*\//g,'');
 assert.equal((s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length,`${name} braces unbalanced`);
}
console.log('PASS static references');
console.log('PASS DOM references');
console.log('PASS homepage navigation');
console.log('PASS poll regression guard');
console.log('PASS Cloudflare beacon sanitation');
console.log('PASS flavour canonical + sitemap');
console.log('PASS CSS structural sanity');
