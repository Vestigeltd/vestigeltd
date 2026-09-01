'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const required = [
  'public/index.html','public/script.js','public/styles.css',
  'src/worker.js','src/zoho-integration.cjs','src/cleanup-expired-checkouts.cjs',
  'wrangler.toml','migrations/0001_checkout_storage.sql','package.json'
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing required Cloudflare deployment file: ${rel}`);
}
for (const rel of ['public/script.js','src/zoho-integration.cjs','src/cleanup-expired-checkouts.cjs']) {
  execFileSync(process.execPath, ['--check', path.join(root, rel)], { stdio: 'inherit' });
}
const wrangler = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
if (!wrangler.includes('binding = "CHECKOUT_DB"')) throw new Error('Missing CHECKOUT_DB D1 binding.');
if (!wrangler.includes('binding = "ASSETS"')) throw new Error('Missing ASSETS binding.');
console.log('Vestige Cloudflare deployment preflight passed.');
