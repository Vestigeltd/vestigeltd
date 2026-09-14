'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const required = [
  'public/index.html',
  'public/discover.css',
  'public/site-nav.js',
  'public/bc10000/index.html',
  'public/script.js',
  'public/styles.css',
  'src/worker.js',
  'src/zoho-integration.cjs',
  'src/cleanup-expired-checkouts.cjs',
  'wrangler.toml',
  'migrations/0001_checkout_storage.sql',
  'package.json'
];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    throw new Error(`Missing required Cloudflare deployment file: ${rel}`);
  }
}

for (const rel of [
  'public/script.js',
  'public/site-nav.js',
  'src/worker.js',
  'src/zoho-integration.cjs',
  'src/cleanup-expired-checkouts.cjs'
]) {
  execFileSync(process.execPath, ['--check', path.join(root, rel)], { stdio: 'inherit' });
}

const wrangler = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
if (!wrangler.includes('binding = "CHECKOUT_DB"')) throw new Error('Missing CHECKOUT_DB D1 binding.');
if (!wrangler.includes('binding = "ASSETS"')) throw new Error('Missing ASSETS binding.');
if (!wrangler.includes('run_worker_first = [')) throw new Error('Missing selective Worker-first routing required for dynamic SEO and canonical handling.');

const home = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const shop = fs.readFileSync(path.join(root, 'public', 'bc10000', 'index.html'), 'utf8');
if (!home.includes('Discover Vestige')) throw new Error('Brand-led home page is missing.');
if (!home.includes('href="/bc10000/"')) throw new Error('Home page does not expose the BC10000 destination.');
if (!shop.includes('ELFBAR <span>BC10000</span>')) throw new Error('Dedicated BC10000 shop page is missing its product H1.');

for (const file of walk(path.join(root, 'public')).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  if (html.includes('href="/#flavours"')) {
    throw new Error(`Stale root flavour anchor found in ${path.relative(root, file)}`);
  }
  if (/Â|Ã|â€™|â€œ|â€|â‡|ðŸ/.test(html)) {
    throw new Error(`Potential UTF-8 mojibake found in ${path.relative(root, file)}`);
  }
}

const publicRoot = path.join(root, 'public');
const backups = walk(publicRoot).filter(f => /\.bak$/i.test(f));
if (backups.length) throw new Error(`Public backup files are not permitted: ${backups.join(', ')}`);

console.log('Vestige Cloudflare deployment preflight passed.');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
