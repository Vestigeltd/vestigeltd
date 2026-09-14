const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const flavours = [
  ['blueberry-mint','Blueberry Mint'],
  ['miami-mint','Miami Mint'],
  ['blue-razz-ice','Blue Razz Ice'],
  ['strawberry-kiwi-ice','Strawberry Kiwi Ice'],
  ['watermelon-ice','Watermelon Ice']
];
const home = read('public/bc10000/index.html');
assert(home.includes('Five ELFBAR BC10000 flavour variants'));
for (const [slug,name] of flavours) {
  assert(home.includes(`href="/flavours/${slug}"`), `homepage missing ${slug}`);
  assert(home.includes(`Explore BC10000 ${name}`), `homepage anchor not descriptive for ${name}`);
}
for (const [slug,name] of flavours) {
  const html = read(`public/flavours/${slug}.html`);
  assert(html.includes('Explore other ELFBAR BC10000 flavours'), `${slug}: related heading missing`);
  assert(html.includes('Compare all five ELFBAR BC10000 flavours'), `${slug}: hub link missing`);
  for (const [other,oname] of flavours) {
    if (other === slug) continue;
    assert(html.includes(`href="/flavours/${other}"`), `${slug}: sibling link missing ${other}`);
    assert(html.includes(`ELFBAR BC10000 ${oname}`), `${slug}: descriptive sibling anchor missing ${oname}`);
  }
  for (const href of ['/contact','/privacy-policy','/terms-and-conditions','/returns-refunds']) {
    assert(html.includes(`href="${href}"`), `${slug}: footer crawl path missing ${href}`);
  }
  assert(html.includes('<link rel="canonical" href="https://vestigeltd.co.za/flavours/'), `${slug}: canonical regressed`);
  assert(html.includes('"availability":"https://schema.org/OutOfStock"'), `${slug}: availability fallback regressed`);
}
const css = read('public/styles.css');
assert(css.includes('V35.26.9 — Internal SEO architecture'));
assert(css.includes('.related-flavour-grid'));
console.log('V35.26.9 internal SEO architecture checks passed.');
