'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const testDir = path.join(root, 'tests');
const tests = fs.readdirSync(testDir)
  .filter(name => name.endsWith('.test.cjs'))
  .sort();

if (!tests.length) throw new Error('No Vestige regression tests were found.');

for (const name of tests) {
  const result = spawnSync(process.execPath, [path.join(testDir, name)], {
    cwd: root,
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Vestige regression suite passed (${tests.length} files).`);
