const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DB = 'vestige-checkout';
const MODE = String(process.argv[2] || 'dry-run').toLowerCase();
const APPLY = MODE === 'apply';
const CONFIRMATION = 'KEEP-V0001-V0004';
const EXPECTED_SEQUENCE = 15;
const NEXT_SEQUENCE_VALUE = 4;
const KEEP_REFS = new Set(['V0001', 'V0004']);
const DELETE_REFS = new Set([
  'V0002', 'V0003', 'V0005', 'V0006', 'V0007', 'V0008',
  'V0009', 'V0010', 'V0011', 'V0012', 'V0013', 'V0014', 'V0015'
]);
const ORDER_NAMESPACES = [
  'vestige-checkouts',
  'vestige-stock-reservations',
  'vestige-stock-locks',
  'vestige-bank-payment-reference-index',
  'vestige-payment-confirmation-locks',
  'vestige-notifications',
  'vestige-owner-audit',
  'vestige-order-sequence'
];
const wranglerJs = path.join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function fail(message) {
  throw new Error(message);
}

function parse(value) {
  try { return JSON.parse(String(value ?? 'null')); } catch { return null; }
}

function refsIn(value) {
  return [...new Set((String(value || '').match(/\bV\d{4,8}\b/gi) || []).map(ref => ref.toUpperCase()))];
}

function referenceOf(row) {
  const data = parse(row.value_json) || {};
  const ref = data?.progress?.paymentReference || data?.response?.paymentReference || data?.paymentReference;
  if (ref) return String(ref).toUpperCase();
  return refsIn(`${row.key} ${row.value_json}`)[0] || '';
}

function stateOf(data) {
  return String(data?.state || data?.status || data?.progress?.state || 'unknown').toLowerCase();
}

function evidenceOf(data) {
  const progress = data?.progress || {};
  return {
    paymentId: data?.zohoPaymentId || data?.paymentId || data?.bankPaymentId ||
      progress?.zohoPaymentId || progress?.paymentId || progress?.bankPaymentId || '',
    invoiceId: data?.zohoInvoiceId || data?.invoiceId || data?.bankInvoiceId ||
      progress?.zohoInvoiceId || progress?.invoiceId || progress?.bankInvoiceId || ''
  };
}

function extractRows(parsed) {
  const output = [];
  function walk(value) {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(walk);
    if (typeof value !== 'object') return;
    if ('namespace' in value && 'key' in value && 'value_json' in value) output.push(value);
    else Object.values(value).forEach(walk);
  }
  walk(parsed);
  return output;
}

function runWrangler(args, options = {}) {
  if (!fs.existsSync(wranglerJs)) fail('Wrangler is missing. Run npm install, then repeat.');
  return execFileSync(process.execPath, [wranglerJs, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: options.stdio || ['ignore', 'pipe', 'pipe']
  });
}

function queryRows() {
  const namespaces = ORDER_NAMESPACES.map(ns => `'${ns}'`).join(',');
  const sql = `SELECT namespace,key,value_json,etag,updated_at FROM kv_store ` +
    `WHERE namespace IN (${namespaces}) ORDER BY namespace,updated_at,key;`;
  const stdout = runWrangler(['d1', 'execute', DB, '--remote', '--json', '--command', sql]);
  return extractRows(JSON.parse(stdout));
}

function sequenceValue(row) {
  const data = parse(row?.value_json);
  if (data && typeof data === 'object') return Number(data.value);
  return Number(data);
}

function nextSequenceJson(row) {
  const current = parse(row.value_json);
  if (!current || typeof current !== 'object' || Array.isArray(current) || !Number.isFinite(Number(current.value))) {
    fail(`Unknown order-sequence shape: ${row.value_json}`);
  }
  return JSON.stringify({ ...current, value: NEXT_SEQUENCE_VALUE, updatedAt: Date.now() });
}

function containsLinkedOrder(row, refs, checkoutIds) {
  const text = `${row.key} ${row.value_json}`;
  return refs.some(ref => refsIn(text).includes(ref)) || checkoutIds.some(id => id && text.includes(id));
}

function filterReservationValue(raw, deleteCheckoutIds) {
  const data = parse(raw);
  const reservations = Array.isArray(data)
    ? data
    : (data && typeof data === 'object' && Array.isArray(data.reservations) ? data.reservations : null);
  if (!reservations) return null;
  const filtered = reservations.filter(item => !deleteCheckoutIds.includes(String(item?.checkoutId || '')));
  if (filtered.length === reservations.length) return null;
  return Array.isArray(data) ? filtered : { ...data, reservations: filtered };
}

function reservationCount(value) {
  return Array.isArray(value) ? value.length : (Array.isArray(value?.reservations) ? value.reservations.length : 0);
}

function planCleanup(rows) {
  const sequenceRow = rows.find(row => row.namespace === 'vestige-order-sequence' && row.key === 'bank-order');
  if (!sequenceRow) fail('Order sequence vestige-order-sequence/bank-order is missing.');
  if (sequenceValue(sequenceRow) !== EXPECTED_SEQUENCE) {
    fail(`Sequence changed after the approved audit (expected ${EXPECTED_SEQUENCE}, found ${sequenceValue(sequenceRow)}). Run the audit again.`);
  }

  const checkoutRows = rows.filter(row => row.namespace === 'vestige-checkouts');
  const byRef = new Map();
  for (const row of checkoutRows) {
    const ref = referenceOf(row);
    if (!ref) fail(`Checkout ${row.key} has no readable payment reference.`);
    if (byRef.has(ref)) fail(`Duplicate checkout reference ${ref} found.`);
    byRef.set(ref, row);
  }

  const approvedRefs = new Set([...KEEP_REFS, ...DELETE_REFS]);
  const unexpected = [...byRef.keys()].filter(ref => !approvedRefs.has(ref));
  const missing = [...approvedRefs].filter(ref => !byRef.has(ref));
  if (unexpected.length || missing.length) {
    fail(`Database no longer matches the approved audit. Unexpected: ${unexpected.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}. Run the audit again.`);
  }

  for (const ref of DELETE_REFS) {
    const row = byRef.get(ref);
    const data = parse(row.value_json) || {};
    const state = stateOf(data);
    const evidence = evidenceOf(data);
    if (['confirmed', 'paid', 'payment_confirmed', 'completed'].includes(state) || evidence.paymentId || evidence.invoiceId) {
      fail(`${ref} now contains sale/payment/invoice evidence. Cleanup aborted; nothing was changed.`);
    }
  }

  for (const ref of KEEP_REFS) {
    const row = byRef.get(ref);
    if (!['confirmed', 'paid', 'payment_confirmed', 'completed'].includes(stateOf(parse(row.value_json) || {}))) {
      fail(`Protected sale ${ref} is no longer confirmed. Cleanup aborted.`);
    }
  }

  const deleteCheckoutIds = [...DELETE_REFS].map(ref => String(byRef.get(ref).key).replace(/^checkout-/, ''));
  const keepCheckoutIds = [...KEEP_REFS].map(ref => String(byRef.get(ref).key).replace(/^checkout-/, ''));
  const operations = [];

  for (const ref of DELETE_REFS) operations.push({ type: 'delete', row: byRef.get(ref), reason: ref });

  for (const row of rows) {
    if (row.namespace === 'vestige-checkouts' || row.namespace === 'vestige-order-sequence') continue;
    const linkedToKeep = containsLinkedOrder(row, [...KEEP_REFS], keepCheckoutIds);
    const linkedToDelete = containsLinkedOrder(row, [...DELETE_REFS], deleteCheckoutIds);

    if (row.namespace === 'vestige-stock-reservations') {
      const filtered = filterReservationValue(row.value_json, deleteCheckoutIds);
      if (!filtered) continue;
      operations.push(reservationCount(filtered)
        ? { type: 'update', row, value: JSON.stringify(filtered), reason: 'remove test reservations only' }
        : { type: 'delete', row, reason: 'remove empty test reservation row' });
      continue;
    }

    if (linkedToKeep && linkedToDelete) {
      fail(`Mixed protected/test data found in ${row.namespace}/${row.key}; refusing an unsafe whole-row deletion.`);
    }
    if (linkedToDelete) operations.push({ type: 'delete', row, reason: refsIn(`${row.key} ${row.value_json}`).join(',') || 'linked checkout' });
  }

  return {
    operations,
    sequenceRow,
    sequenceJson: nextSequenceJson(sequenceRow),
    deleteCheckoutIds,
    keepCheckoutIds,
    keepSnapshots: [...KEEP_REFS].map(ref => ({ ref, key: byRef.get(ref).key, value_json: byRef.get(ref).value_json }))
  };
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

function guardedWhere(row) {
  return `namespace='${sqlEscape(row.namespace)}' AND key='${sqlEscape(row.key)}' AND etag='${sqlEscape(row.etag)}'`;
}

function buildSql(plan) {
  const lines = [`-- V35.22 approved cleanup: preserve V0001 and V0004; next reference V0005.`];
  for (const operation of plan.operations) {
    if (operation.type === 'delete') lines.push(`DELETE FROM kv_store WHERE ${guardedWhere(operation.row)};`);
    else lines.push(`UPDATE kv_store SET value_json='${sqlEscape(operation.value)}', etag='cleanup-${Date.now()}', updated_at=${Date.now()} WHERE ${guardedWhere(operation.row)};`);
  }
  lines.push(`UPDATE kv_store SET value_json='${sqlEscape(plan.sequenceJson)}', etag='cleanup-sequence-${Date.now()}', updated_at=${Date.now()} WHERE ${guardedWhere(plan.sequenceRow)};`);
  return lines.join('\n') + '\n';
}

function makeOutputDirectory() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(process.cwd(), 'shop-records-cleanup', stamp);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function savePlan(plan, dir) {
  const report = {
    createdAt: new Date().toISOString(),
    database: DB,
    protectedReferences: [...KEEP_REFS],
    deletedTestReferences: [...DELETE_REFS],
    sequenceBefore: EXPECTED_SEQUENCE,
    sequenceAfter: NEXT_SEQUENCE_VALUE,
    nextReference: 'V0005',
    rowOperations: plan.operations.map(op => ({ type: op.type, namespace: op.row.namespace, key: op.row.key, reason: op.reason }))
  };
  fs.writeFileSync(path.join(dir, 'cleanup-plan.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(dir, 'cleanup.sql'), buildSql(plan));
}

function backupDatabase(dir) {
  const output = path.join(dir, 'vestige-checkout-before-cleanup.sql');
  runWrangler(['d1', 'export', DB, '--remote', '--output', output, '--skip-confirmation']);
  if (!fs.existsSync(output) || fs.statSync(output).size === 0) fail('Remote D1 backup was not created. Cleanup stopped.');
  return output;
}

function verifyCleanup(rows, plan) {
  const checkoutRefs = rows.filter(row => row.namespace === 'vestige-checkouts').map(referenceOf).sort();
  if (JSON.stringify(checkoutRefs) !== JSON.stringify([...KEEP_REFS].sort())) fail(`Verification failed: remaining checkout references are ${checkoutRefs.join(', ')}.`);
  const sequenceRow = rows.find(row => row.namespace === 'vestige-order-sequence' && row.key === 'bank-order');
  if (sequenceValue(sequenceRow) !== NEXT_SEQUENCE_VALUE) fail('Verification failed: order sequence is not 4.');
  for (const snapshot of plan.keepSnapshots) {
    const row = rows.find(item => item.namespace === 'vestige-checkouts' && item.key === snapshot.key);
    if (!row || row.value_json !== snapshot.value_json) fail(`Verification failed: protected sale ${snapshot.ref} changed.`);
  }
  const residual = rows.filter(row => row.namespace !== 'vestige-order-sequence' && containsLinkedOrder(row, [...DELETE_REFS], plan.deleteCheckoutIds));
  if (residual.length) fail(`Verification failed: ${residual.length} linked test row(s) remain.`);
  return { checkoutRefs, sequence: NEXT_SEQUENCE_VALUE, residualRows: 0 };
}

function main() {
  console.log('\nVESTIGE SHOP RECORD CLEANUP V35.22');
  console.log('Protected genuine sales: V0001, V0004');
  console.log('Approved test records: V0002, V0003, V0005-V0015');
  console.log('Next safe customer reference after cleanup: V0005\n');

  const initialRows = queryRows();
  const initialPlan = planCleanup(initialRows);
  const dir = makeOutputDirectory();
  savePlan(initialPlan, dir);
  console.log(`Planned row changes: ${initialPlan.operations.length}`);
  console.log(`Plan saved: ${path.join(dir, 'cleanup-plan.json')}`);

  if (!APPLY) {
    console.log('\nDRY RUN COMPLETE — nothing was changed.');
    return;
  }
  if (String(process.env.VESTIGE_CLEAN_CONFIRM || '').trim().toUpperCase() !== CONFIRMATION) {
    fail(`Apply requires VESTIGE_CLEAN_CONFIRM=${CONFIRMATION}. Nothing was changed.`);
  }

  const backup = backupDatabase(dir);
  console.log(`Backup created: ${backup}`);

  // Re-read after backup so a new order or owner action cannot be hidden by the export delay.
  const freshRows = queryRows();
  const freshPlan = planCleanup(freshRows);
  savePlan(freshPlan, dir);
  runWrangler(['d1', 'execute', DB, '--remote', '--file', path.join(dir, 'cleanup.sql'), '--yes'], { stdio: 'inherit' });

  const result = verifyCleanup(queryRows(), freshPlan);
  fs.writeFileSync(path.join(dir, 'verification.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), ...result }, null, 2));
  console.log('\nCLEANUP VERIFIED.');
  console.log('Remaining sales: V0001, V0004');
  console.log('Sequence value: 4 (next reference: V0005)');
  console.log('Linked test rows remaining: 0');
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`\nSTOPPED: ${error.message}`); process.exitCode = 1; }
}

module.exports = {
  KEEP_REFS, DELETE_REFS, EXPECTED_SEQUENCE, NEXT_SEQUENCE_VALUE,
  refsIn, referenceOf, stateOf, evidenceOf, sequenceValue,
  filterReservationValue, reservationCount, planCleanup, buildSql, verifyCleanup
};
