'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const required = [
  'public/index.html',
  'public/script.js',
  'public/styles.css',
  'netlify/functions/zoho-integration.js',
  'netlify/functions/cleanup-expired-checkouts.js',
  'netlify.toml',
  'package.json',
];

for (const rel of required) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing required deployment file: ${rel}`);
}

for (const rel of ['public/script.js', 'netlify/functions/zoho-integration.js', 'netlify/functions/cleanup-expired-checkouts.js']) {
  execFileSync(process.execPath, ['--check', path.join(root, rel)], { stdio: 'inherit' });
}

(async () => {
  const blobs = await import('@netlify/blobs');
  if (typeof blobs.getStore !== 'function') throw new Error('@netlify/blobs did not expose getStore().');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (pkg.dependencies?.['@netlify/blobs'] !== '10.7.13') throw new Error('Unexpected @netlify/blobs version.');
  console.log('Vestige deployment preflight passed.');
})().catch(error => {
  console.error('Vestige deployment preflight failed:', error.message);
  process.exit(1);
});
