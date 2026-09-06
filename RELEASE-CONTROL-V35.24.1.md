# Vestige V35.24.1 — Dynamic Owner Test-Order Cleanup

## Release identity

- Release: V35.24.1
- Source baseline: user-supplied `Cloudflare(3).zip`, including the V35.24.0 payment-header and owner-cleanup work
- Cloudflare Worker: `vestigeltd`
- D1 database: `vestige-checkout`
- Worker entry point: `src/worker.js`
- Assets directory: `public/`

## Changes

1. The payment page keeps the fixed dark-blue, brand-only header from V35.24.0.
2. Owner test-order cleanup is now dynamic instead of fixed to V0005:
   - preserve every internal website order with financial evidence or a confirmed/paid/completed state;
   - calculate the next reference as the highest preserved genuine website reference plus one;
   - display both the protected references and calculated next reference in the preview;
   - generate a matching confirmation phrase, for example `RESET TO V0008`;
   - remove only the non-financial records explicitly listed as test candidates;
   - set the internal website sequence to the calculated value and verify the result.
3. Zoho Books invoices and payments are never modified by this maintenance action.

For the current approved data, V0004 is the highest preserved genuine order, so the first cleanup still calculates V0005. If V0007 is later the highest preserved genuine order, the same control calculates V0008.

## Cleanup safety gates

- The existing payment-admin key is required.
- Preview is mandatory and read-only.
- The owner must inspect every proposed test order before continuing.
- The exact server-calculated confirmation phrase is required.
- A 64-character snapshot fingerprint prevents applying a stale preview.
- Any `confirming_payment` record without completed financial evidence blocks cleanup for manual review.
- Missing/invalid references, duplicate references, mixed genuine/test linked rows and calculated-reference collisions block cleanup.
- The eight-digit reference ceiling blocks cleanup rather than producing an invalid reference.
- D1 writes use a batch, row etags and post-change verification.
- The control is not an arbitrary invoice/reference editor.

## Owner use after deployment

1. Open `https://vestigeltd.co.za/owner.html` and unlock the Owner Console.
2. Under **Test Order Housekeeping**, select **Preview cleanup**.
3. Verify every listed candidate is a test and review the protected genuine references.
4. Confirm the calculated next reference.
5. Type the exact phrase displayed by the preview.
6. Select **Delete eligible tests & reset** and accept the final warning.
7. Confirm the success message shows the expected next website reference.

## Evidence boundary

Local deterministic tests verify both today's V0005 result and a later V0008 result, plus authorization, stale/incorrect confirmation, collision, in-progress payment and range-exhaustion safeguards. Local verification does not deploy the Worker or apply a live D1 cleanup. The live database changes only when the owner uses the deployed control.
