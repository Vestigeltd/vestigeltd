'use strict';

const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const workerPath = path.join(projectRoot, 'src', 'zoho-integration.cjs');
const frontendPath = path.join(projectRoot, 'public', 'script.js');
const workerSource = fs.readFileSync(workerPath, 'utf8');
const frontendSource = fs.readFileSync(frontendPath, 'utf8');

function loadWorkerHooks() {
  const instrumented = workerSource + '\nexports.__paymentAlertTest = { notifyOwnerOnce, sendOwnerEmail };\n';
  const instance = new Module(workerPath, module);
  instance.filename = workerPath;
  instance.paths = Module._nodeModulePaths(path.dirname(workerPath));
  instance._compile(instrumented, workerPath);
  return instance.exports;
}

class FakeD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const database = this;
    return {
      bind(...args) {
        return {
          async first() {
            const key = `${args[0]}:${args[1]}`;
            const row = database.rows.get(key);
            return row ? { value_json: row.value_json, etag: row.etag } : null;
          },
          async run() {
            const key = `${args[0]}:${args[1]}`;
            if (sql.includes('INSERT OR IGNORE')) {
              if (database.rows.has(key)) return { meta: { changes: 0 } };
              database.rows.set(key, { value_json: args[2], etag: args[3], updated_at: args[4] });
              return { meta: { changes: 1 } };
            }
            if (sql.includes('WHERE namespace = ?1 AND key = ?2 AND etag = ?6')) {
              const current = database.rows.get(key);
              if (!current || current.etag !== args[5]) return { meta: { changes: 0 } };
              database.rows.set(key, { value_json: args[2], etag: args[3], updated_at: args[4] });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('INSERT INTO kv_store')) {
              database.rows.set(key, { value_json: args[2], etag: args[3], updated_at: args[4] });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('DELETE FROM kv_store')) {
              const changed = database.rows.delete(key);
              return { meta: { changes: changed ? 1 : 0 } };
            }
            throw new Error(`Unsupported test SQL: ${sql}`);
          },
        };
      },
    };
  }
}

async function run() {
  const originalFetch = global.fetch;
  try {
    const database = new FakeD1();
    const worker = loadWorkerHooks();
    worker.bindCloudflareRuntime({
      CHECKOUT_DB: database,
      RESEND_API_KEY: 're_test_key',
      OWNER_ALERT_EMAIL: 'ignored-recipient@example.com',
      OWNER_ALERT_FROM_EMAIL: 'ignored-sender@example.com',
    });

    const requests = [];
    global.fetch = async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, async json() { return { id: 'email-1' }; } };
    };

    const first = await worker.__paymentAlertTest.notifyOwnerOnce(
      'payment-claimed', 'V0099', 'Customer says paid', 'Check the cleared bank credit.'
    );
    assert.equal(first.sent, true, 'First owner alert should report successful delivery.');
    assert.equal(requests.length, 1, 'First owner alert should send exactly one email.');
    assert.equal(requests[0].options.headers['Idempotency-Key'], 'vestige/payment-claimed/V0099');
    const firstEmail = JSON.parse(requests[0].options.body);
    assert.equal(firstEmail.from, 'Vestige Vapes <contact@vestigeltd.co.za>', 'Owner alerts must be sent only from the verified contact address.');
    assert.deepEqual(firstEmail.to, ['contact@vestigeltd.co.za'], 'Owner alerts must be delivered only to the verified contact address.');
    assert.equal(firstEmail.reply_to, 'contact@vestigeltd.co.za', 'Replies must return only to the verified contact address.');

    const replay = await worker.__paymentAlertTest.notifyOwnerOnce(
      'payment-claimed', 'V0099', 'Customer says paid', 'Check the cleared bank credit.'
    );
    assert.equal(replay.sent, true, 'Replayed alert should return the durable sent result.');
    assert.equal(replay.replayed, true, 'Replayed alert should be identified as a replay.');
    assert.equal(requests.length, 1, 'Replayed alert must not send a duplicate email.');

    let releaseSend;
    global.fetch = async (url, options) => {
      requests.push({ url, options });
      await new Promise(resolve => { releaseSend = resolve; });
      return { ok: true, status: 200, async json() { return { id: 'email-race' }; } };
    };
    const racingFirst = worker.__paymentAlertTest.notifyOwnerOnce(
      'payment-claimed', 'V0100', 'Customer says paid', 'Check the cleared bank credit.'
    );
    while (!releaseSend) await new Promise(resolve => setImmediate(resolve));
    const racingSecond = await worker.__paymentAlertTest.notifyOwnerOnce(
      'payment-claimed', 'V0100', 'Customer says paid', 'Check the cleared bank credit.'
    );
    assert.equal(racingSecond.pending, true, 'Concurrent duplicate should observe the delivery lease.');
    assert.equal(requests.length, 2, 'Two simultaneous claims must still create only one email request.');
    releaseSend();
    assert.equal((await racingFirst).sent, true);

    let failOnce = true;
    global.fetch = async (url, options) => {
      requests.push({ url, options });
      if (failOnce) {
        failOnce = false;
        return { ok: false, status: 503, async json() { return { message: 'Temporary delivery failure' }; } };
      }
      return { ok: true, status: 200, async json() { return { id: 'email-retry' }; } };
    };
    const failed = await worker.__paymentAlertTest.notifyOwnerOnce(
      'payment-claimed', 'V0101', 'Customer says paid', 'Check the cleared bank credit.'
    );
    assert.equal(failed.sent, false, 'Failed owner delivery must never be reported as sent.');
    const retried = await worker.__paymentAlertTest.notifyOwnerOnce(
      'payment-claimed', 'V0101', 'Customer says paid', 'Check the cleared bank credit.'
    );
    assert.equal(retried.sent, true, 'A failed owner alert must remain safely retryable.');
    const retryRequests = requests.slice(-2);
    assert.equal(retryRequests[0].options.headers['Idempotency-Key'], retryRequests[1].options.headers['Idempotency-Key']);

    assert(workerSource.includes("if (state === 'confirmed')"), 'Confirmed orders need an idempotent response.');
    assert(workerSource.includes("if (!['pending_payment', 'confirming_payment'].includes(state))"), 'Invalid order states must reject claims.');
    assert(workerSource.includes('This is not proof of payment.'), 'Owner alert must explicitly reject payment claims as proof.');
    assert(!workerSource.slice(workerSource.indexOf('async function claimBankPayment'), workerSource.indexOf('async function prepareBankOrder')).includes('confirmBankPaymentManually('), 'Customer payment claim must never call owner confirmation.');

    assert(frontendSource.includes("if(result.ownerAlertSent)"), 'Customer UI must distinguish successful and failed owner alerts.');
    assert(frontendSource.includes("paid.textContent='Retry payment notice'"), 'Customer needs a visible retry after alert failure.');
    assert(frontendSource.includes("paid.textContent='Payment notice sent'"), 'Successful payment notice should become visibly final.');

    console.log('V35.21 payment-alert adversarial checks passed (25 assertions).');
  } finally {
    global.fetch = originalFetch;
  }
}

run().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
