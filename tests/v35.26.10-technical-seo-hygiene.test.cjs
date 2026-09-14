const fs=require('fs'); const path=require('path'); const assert=require('assert');
const root=path.join(__dirname,'..');
const pub=path.join(root,'public');
const pages=['index.html','bc10000/index.html','contact.html','privacy-policy.html','terms-and-conditions.html','returns-refunds.html','flavours/blueberry-mint.html','flavours/miami-mint.html','flavours/blue-razz-ice.html','flavours/strawberry-kiwi-ice.html','flavours/watermelon-ice.html'];
for(const rel of pages){const h=fs.readFileSync(path.join(pub,rel),'utf8'); assert.match(h,/<title>[^<]+<\/title>/); assert.match(h,/name="description"/); assert.match(h,/rel="canonical"/); assert.match(h,/property="og:title"/); assert.match(h,/property="og:description"/); assert.match(h,/property="og:url"/); assert.match(h,/property="og:image"/); assert.match(h,/name="twitter:card"/); assert.match(h,/name="twitter:title"/); assert.match(h,/name="twitter:description"/); assert.match(h,/name="twitter:image"/);}
const sm=fs.readFileSync(path.join(pub,'sitemap.xml'),'utf8'); assert(!sm.includes('<priority>')); assert(!sm.includes('<changefreq>')); assert.equal((sm.match(/<url>/g)||[]).length,12); for(const x of ['privacy-policy','terms-and-conditions','returns-refunds','blueberry-mint','watermelon-ice']) assert(sm.includes(x)); assert(sm.includes('xmlns:image='));
const robots=fs.readFileSync(path.join(pub,'robots.txt'),'utf8'); assert(robots.includes('Sitemap: https://vestigeltd.co.za/sitemap.xml'));
console.log('V35.26.10 technical SEO hygiene checks passed');
