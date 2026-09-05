const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const contactHtml = fs.readFileSync(path.join(root, 'public', 'contact.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public', 'script.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'src', 'zoho-integration.cjs'), 'utf8');
const retiredOrdersEmail = ['orders', 'vestigeltd.co.za'].join('@');
const retiredGmail = ['vestigeltd.mp', 'gmail.com'].join('@');

function projectTextFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name.endsWith('.zip')) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? projectTextFiles(fullPath) : [fullPath];
  });
}

const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
assert(jsonLdMatch, 'Homepage JSON-LD is missing.');
const graph = JSON.parse(jsonLdMatch[1])['@graph'];
const product = graph.find(item => item['@type'] === 'Product');
const organization = graph.find(item => item['@type'] === 'Organization');
assert(organization, 'Organization structured data is missing.');
assert.equal(organization.contactPoint?.email, 'contact@vestigeltd.co.za');
for (const file of projectTextFiles(root)) {
  const content = fs.readFileSync(file, 'utf8');
  assert(!content.includes(retiredOrdersEmail), `The retired orders address remains in ${path.relative(root, file)}.`);
  assert(!content.includes(retiredGmail), `The retired Gmail address remains in ${path.relative(root, file)}.`);
}
assert(workerSource.includes("const CONTACT_EMAIL = 'contact@vestigeltd.co.za';"), 'The Worker must use the verified contact address as its single notification identity.');
assert(product, 'BC10000 Product structured data is missing.');
assert.equal(product.name, 'ELFBAR BC10000');
assert.equal(product.brand.name, 'ELFBAR');
assert.equal(product.offers?.['@type'], 'Offer');
assert.equal(product.offers?.price, '300.00');
assert.equal(product.offers?.priceCurrency, 'ZAR');
assert.equal(product.offers?.url, 'https://vestigeltd.co.za/#buy-now');
assert.equal(product.offers?.seller?.['@id'], 'https://vestigeltd.co.za/#organization');
assert.equal(product.offers?.availability, undefined, 'Static structured data must not claim live availability.');
assert.match(contactHtml, /href="mailto:contact@vestigeltd\.co\.za">contact@vestigeltd\.co\.za<\/a>/);
assert(!contactHtml.includes(retiredOrdersEmail));

assert.match(html, /<title>ELFBAR BC10000 South Africa \| 5 Flavours \| Vestige Vapes<\/title>/);
assert.match(html, /Shop ELFBAR BC10000 in South Africa for R300[^>]*name="description"/);
assert.match(html, /id="product"/);
assert.match(html, /id="bc10000-build"/);
assert.match(html, /id="specifications"/);
assert.doesNotMatch(html, /<a href="#specifications">Technical Profile<\/a>/);
assert.match(html, /INTRODUCING ELFBAR/);
assert.match(html, /Design-led from the beginning/);
assert.match(html, /international design and industry awards/);
assert.match(html, /ELFBAR BC10000<\/p><h2>High capacity without the ceremony/);
assert.match(html, /Engineered around the essentials/);
assert.doesNotMatch(html, /Reuters|more than 9%|invented ranking|Market position varies/);
assert.doesNotMatch(html, /QUAQ|Quaq|15–20 minutes|Puff 1 to 10,000/);
assert.match(html, /Product appearance alone cannot prove authenticity/);
assert.match(html, /Puff count is based on manufacturer testing and varies/);
assert.match(html, /<th>E-liquid volume<\/th><td>18 ml<\/td>/);
assert.match(html, /<th>Coil technology<\/th><td>Mesh coil<\/td>/);
assert.match(html, /<th>Charging<\/th><td>USB-C \/ Type-C<\/td>/);
assert.match(html, /<th>Display<\/th><td>Real-time battery and e-liquid status<\/td>/);
assert.match(html, /<th>Airflow<\/th><td>Draw-activated<\/td>/);
assert.match(html, /<th>Dimensions<\/th><td>85 × 43 × 22 mm<\/td>/);
assert.match(css, /\.component-story\{background:#f4f1ea/);
assert.match(html, /Blueberry fruit notes with a cool mint finish/);
assert.match(html, /A clean mint profile with a cooling character/);
assert.match(html, /Blue raspberry-style berry notes with an icy finish/);
assert.match(html, /Strawberry and kiwi fruit notes paired with a cool finish/);
assert.match(html, /Juicy watermelon character with a chilled finish/);

for (const image of [
  'bc10000-showcase-v3-optimized.jpg',
  'flavour-icon-blueberry-mint.png',
  'flavour-icon-miami-mint.png',
  'flavour-icon-blue-razz-ice.png',
  'flavour-icon-strawberry-kiwi-ice.png',
  'flavour-icon-watermelon-ice.png'
]) {
  assert(html.includes(`assets/${image}`), `Campaign image is not used: ${image}`);
  assert(fs.statSync(path.join(root, 'public', 'assets', image)).size > 50_000, `Campaign image is unexpectedly small: ${image}`);
}

assert.match(html, /<video[^>]*class="device-video"/);
assert.match(html, /data-src="assets\/bc10000\.mp4"/);
assert(fs.statSync(path.join(root, 'public', 'assets', 'bc10000.mp4')).size > 500_000, 'Technical visual source was degraded or replaced.');
assert.match(css, /\.compact-spec-layout \.device-stage\{min-height:470px;max-height:470px\}/);
assert.match(script, /bank-payments\.css\?v=35\.22\.0/);
assert.match(html, /styles\.css\?v=35\.23\.2/);
assert.match(css, /flavour-icon\{position:absolute;inset:6px 5% auto;width:90%;height:48%/);
assert.match(html, /script\.js\?v=35\.23\.2/);

console.log('V35.23.0 campaign, SEO, contact and technical-profile checks passed.');
