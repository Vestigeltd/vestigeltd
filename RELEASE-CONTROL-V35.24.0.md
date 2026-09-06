# Vestige V35.24.0 — Payment Header and Owner Cleanup

## Release identity

- Release: V35.24.0
- Source baseline: user-supplied `Cloudflare(3).zip` / V35.23.2
- Cloudflare Worker: `vestigeltd`
- D1 database: `vestige-checkout`
- Worker entry point: `src/worker.js`
- Assets directory: `public/`

## Changes

1. Payment mode now uses a fixed dark-blue header containing only the Vestige Ltd logo and `VESTIGE VAPES` brand text.
2. The protected Owner Console now has a two-stage website test-order cleanup:
   - preview affected internal D1 records;
   - inspect reference, state, customer, amount and creation time;
   - type `RESET TO V0005` and accept the final warning;
   - preserve genuine orders V0001 and V0004;
   - remove eligible linked test records and reservations;
   - set the internal sequence to 4 so V0005 is next;
   - write a maintenance audit event.
3. Zoho Books invoices and payments are never modified by this maintenance action.

## Cleanup safety gates

- The existing payment-admin key is required.
- Preview is mandatory and is read-only.
- A 64-character snapshot fingerprint prevents applying a stale preview.
- Confirmed, paid, completed, payment-confirming, invoice-linked or payment-linked candidate records block the complete cleanup.
- Missing or unconfirmed protected orders V0001/V0004 block the complete cleanup.
- Mixed genuine/test linked rows block the complete cleanup.
- D1 writes use an atomic batch plus row etags and post-change verification.
- The feature is intentionally fixed to the approved V0005 reset; it is not an arbitrary sequence editor.

## Owner use after deployment

1. Open `https://vestigeltd.co.za/owner.html`.
2. Unlock the Owner Console.
3. In **Test Order Housekeeping**, select **Preview cleanup**.
4. Confirm every listed order is a test. If any customer order is listed, stop.
5. Type `RESET TO V0005`.
6. Select **Delete eligible tests & reset** and accept the final warning.
7. Confirm the success message states that V0005 is next.

## Verification completed locally

- Cloudflare source preflight: passed.
- V35.24 payment-header and reset safeguards: passed.
- V35.24 protected reset API boundary test: passed.
- V35.24 focused regression suite: passed.
- V35.21 payment-flow, HTTP-boundary, order-validation and payment-alert suites: passed.
- V35.23 campaign and sold-out suites: passed.
- V35.22 cleanup safeguards: passed.

## Evidence boundary

Local verification proves source behavior against deterministic fixtures. It does not prove a Cloudflare build, deployment, live browser rendering or remote D1 cleanup. Perform the normal dry run and preview deployment before production promotion. The live D1 reset occurs only when the owner applies it from the deployed Owner Console.
