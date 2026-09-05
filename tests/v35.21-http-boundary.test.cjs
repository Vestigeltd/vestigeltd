'use strict';

const assert = require('assert');
const worker = require('../src/zoho-integration.cjs');

worker.bindCloudflareRuntime({
  ZOHO_CLIENT_ID: 'test-client',
  ZOHO_CLIENT_SECRET: 'test-secret',
  ZOHO_REFRESH_TOKEN: 'test-refresh',
  ZOHO_ORGANIZATION_ID: 'test-org',
  CHECKOUT_SIGNING_SECRET: '0123456789abcdef0123456789abcdef',
  VESTIGE_COLLECTION_ACCESS_CODE: 'test-code-123',
  ALLOWED_ORIGIN: 'https://vestigeltd.co.za',
});

function event(overrides = {}) {
  return {
    path: '/api/zoho',
    httpMethod: 'POST',
    headers: { origin: 'https://vestigeltd.co.za', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'unknown_action' }),
    ...overrides,
  };
}

async function expectStatus(input, status, messagePart) {
  const result = await worker.handler(input);
  const body = JSON.parse(result.body);
  assert.equal(result.statusCode, status, `Expected ${status}, received ${result.statusCode}: ${result.body}`);
  assert(String(body.message).includes(messagePart), `Expected message containing "${messagePart}", received "${body.message}"`);
  assert.equal(result.headers['Cache-Control'], 'no-store, max-age=0');
}

(async () => {
  await expectStatus(event({ path: '/direct-function' }), 404, 'Not found');
  await expectStatus(event({ httpMethod: 'GET', body: null }), 405, 'Method not allowed');
  await expectStatus(event({ headers: { origin: 'https://attacker.example', 'content-type': 'application/json' } }), 403, 'Origin not allowed');
  await expectStatus(event({ headers: { origin: 'https://vestigeltd.co.za', 'content-type': 'text/plain' } }), 415, 'Content-Type must be application/json');
  await expectStatus(event({ body: '' }), 400, 'Request body is required');
  await expectStatus(event({ body: '{broken-json' }), 400, 'Invalid JSON body');
  await expectStatus(event({ body: 'x'.repeat(20 * 1024 + 1) }), 413, 'Payload too large');
  await expectStatus(event(), 400, 'Unknown action');
  await expectStatus(event({ body: JSON.stringify({ action: 'verify_collection_access', checkoutId: 'checkout-1234567890', code: 'wrong-code' }) }), 401, 'Collection access code was not accepted');

  const malformedOrigin = event();
  malformedOrigin.headers.origin = 'not a URL';
  await expectStatus(malformedOrigin, 403, 'Origin not allowed');

  console.log('V35.21 HTTP-boundary checks passed (30 assertions).');
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
