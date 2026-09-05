const assert = require('node:assert/strict');
const cleanup = require('../SHOP-RECORDS-CLEANUP-V35.22.js');

function row(namespace, key, value, etag = `${namespace}-${key}`) {
  return { namespace, key, value_json: JSON.stringify(value), etag, updated_at: 1 };
}

const refs = ['V0001', 'V0002', 'V0003', 'V0004', 'V0005', 'V0006', 'V0007', 'V0008', 'V0009', 'V0010', 'V0011', 'V0012', 'V0013', 'V0014', 'V0015'];
const checkoutRows = refs.map((ref, index) => row('vestige-checkouts', `checkout-id-${index + 1}`, {
  state: ref === 'V0001' || ref === 'V0004' ? 'confirmed' : ref === 'V0012' || ref === 'V0014' ? 'pending_payment' : 'cancelled_customer',
  progress: { paymentReference: ref, paymentClaimedAt: ref === 'V0002' || ref === 'V0005' ? 10 : undefined }
}));

const fixture = [
  ...checkoutRows,
  row('vestige-order-sequence', 'bank-order', { value: 15, updatedAt: 1 }),
  row('vestige-bank-payment-reference-index', 'V0001', { checkoutId: 'id-1', paymentReference: 'V0001' }),
  row('vestige-bank-payment-reference-index', 'V0002', { checkoutId: 'id-2', paymentReference: 'V0002' }),
  row('vestige-stock-reservations', 'item-a', [
    { checkoutId: 'id-1', quantity: 1 },
    { checkoutId: 'id-12', quantity: 1 },
    { checkoutId: 'unrelated-id', quantity: 1 }
  ]),
  row('vestige-notifications', 'payment-claimed:V0002', { paymentReference: 'V0002' }),
  row('vestige-owner-audit', 'general-health-check', { action: 'health_check' })
];

const plan = cleanup.planCleanup(fixture);
assert.deepEqual([...cleanup.KEEP_REFS], ['V0001', 'V0004']);
assert.equal(cleanup.NEXT_SEQUENCE_VALUE, 4);
assert.match(plan.sequenceJson, /"value":4/);
assert(plan.operations.some(op => op.type === 'delete' && op.row.namespace === 'vestige-checkouts' && cleanup.referenceOf(op.row) === 'V0014'));
assert(!plan.operations.some(op => op.row.namespace === 'vestige-checkouts' && cleanup.referenceOf(op.row) === 'V0001'));
assert(!plan.operations.some(op => op.row.namespace === 'vestige-checkouts' && cleanup.referenceOf(op.row) === 'V0004'));

const reservationOp = plan.operations.find(op => op.row.namespace === 'vestige-stock-reservations');
assert.equal(reservationOp.type, 'update');
assert.deepEqual(JSON.parse(reservationOp.value), [
  { checkoutId: 'id-1', quantity: 1 },
  { checkoutId: 'unrelated-id', quantity: 1 }
]);

const objectReservationFixture = fixture.map(item => item.namespace === 'vestige-stock-reservations'
  ? row('vestige-stock-reservations', 'item-a', {
      reservations: [
        { checkoutId: 'id-1', quantity: 1 },
        { checkoutId: 'id-12', quantity: 1 },
        { checkoutId: 'unrelated-id', quantity: 1 }
      ],
      updatedAt: 12345
    })
  : item);
const objectReservationPlan = cleanup.planCleanup(objectReservationFixture);
const objectReservationOp = objectReservationPlan.operations.find(op => op.row.namespace === 'vestige-stock-reservations');
assert.equal(objectReservationOp.type, 'update');
assert.deepEqual(JSON.parse(objectReservationOp.value), {
  reservations: [
    { checkoutId: 'id-1', quantity: 1 },
    { checkoutId: 'unrelated-id', quantity: 1 }
  ],
  updatedAt: 12345
});

const sql = cleanup.buildSql(plan);
assert.match(sql, /etag='/);
assert.match(sql, /"value":4/);
assert.doesNotMatch(sql, /V0001.*DELETE/);

assert.throws(() => cleanup.planCleanup(fixture.map(item =>
  item.namespace === 'vestige-order-sequence' ? row(item.namespace, item.key, { value: 16 }) : item
)), /Sequence changed/);

assert.throws(() => cleanup.planCleanup(fixture.map(item => {
  if (item.namespace !== 'vestige-checkouts' || cleanup.referenceOf(item) !== 'V0005') return item;
  return row(item.namespace, item.key, { state: 'confirmed', progress: { paymentReference: 'V0005', bankPaymentId: 'payment-1' } });
})), /sale\/payment\/invoice evidence/);

assert.throws(() => cleanup.planCleanup([...fixture, row('vestige-checkouts', 'checkout-new', {
  state: 'pending_payment', progress: { paymentReference: 'V0016' }
})]), /Database no longer matches/);

console.log('V35.22 shop-record cleanup safeguards: PASS');
