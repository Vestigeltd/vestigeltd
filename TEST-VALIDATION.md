# Vestige Vapes V22 — exact-repository adversarial validation

V22 is based on the exact GitHub repository ZIP supplied by the owner. Tests execute the actual modified `netlify/functions/zoho-integration.js` with deterministic mocked Zoho Books/PayPal responses and a strongly-consistent in-memory implementation of the Netlify Blob conditional-write semantics used by production.

## Executed backend/integration suite — 19/19 PASS

1. **Availability works without Blobs** — page-load Zoho stock succeeds without touching checkout Blob storage.
2. **Canonical Function bypass closed** — direct `/.netlify/functions/zoho-integration` request is rejected; the public route is `/api/zoho` where rate limiting is configured.
3. **Protected deployment diagnostic** — `connection_test` verifies Zoho organization, all five stock mappings, Courier delivery item and a real atomic Blob create/read/conditional-update/delete cycle.
4. **Committed/available stock wins** — explicit available stock of zero overrides higher physical/location stock.
5. **Blob outage isolation** — stock display remains HTTP 200; checkout fails HTTP 503 before any Customer, Sales Order or Invoice write.
6. **Open Sales Order does not require an immediate Item-field decrement** — valid checkout succeeds when Zoho confirms the exact Sales Order is Open with the exact item/quantity even if the Items endpoint has not yet visibly reduced the field used for the page snapshot.
7. **Identical retry is idempotent** — retry with the same checkout ID and exact fingerprint replays the existing pending transaction; no duplicate Sales Order/invoice.
8. **Changed checkout replay blocked** — same checkout ID with changed quantity/customer instruction returns conflict.
9. **Tampered browser total blocked** — server recalculates R300 × quantity + R60 and rejects mismatch.
10. **Wrong item identity blocked** — a Zoho item ID cannot be paired with a different flavour.
11. **Price drift blocked** — Zoho rate changing away from R300 after page load prevents the order.
12. **Inactive item blocked** — product becoming inactive after page load prevents the order.
13. **Split stock not pooled** — separate locations are not summed to fulfil an order that no single location can fulfil.
14. **Exact item out of stock blocked** — no Sales Order is created when the authoritative exact item cannot fulfil the quantity.
15. **Payment attacks blocked** — unpaid, partial, manual/cash and refunded payment states cannot confirm; one exact successful online PayPal payment can.
16. **Receipt retrieval** — verified Zoho Customer Payment PDF is returned only after successful payment verification.
17. **Post-payment stale-stock bridge** — a recently confirmed order continues to reserve its quantity briefly so a stale Zoho Items read cannot immediately resell the same units.
18. **Concurrent final-unit attack** — two simultaneous buyers cannot both reserve the final unit; distributed exact-item locking allows only one Sales Order path to win.
19. **Sequential stale-stock attack** — even after the item lock is released, a second buyer cannot purchase the final unit when Zoho has not yet exposed the first Open Sales Order in the Items stock fields.

## Important failure-path assertions

### Blob outage

Expected:

```
availability → HTTP 200
prepare_order → HTTP 503
Customer POST count → 0
Sales Order POST count → 0
Invoice POST count → 0
```

Result: **PASS**.

### Stock field ambiguity

Test input:

```
location_stock_on_hand = 10
item available_stock = 0
location-level available fields = blank
```

Expected: available quantity = 0, not 10.

Result: **PASS**.

### Multi-location fragmentation

Test input:

```
Location A = 3 available
Location B = 3 available
customer quantity = 5
```

Expected: reject; do not invent a six-unit combined pool.

Result: **PASS**.

### Concurrent final unit

Test input:

```
stock = 1
two prepare_order requests at the same time
```

Expected: only one reservation path can proceed.

Result: **PASS**.

### Sequential stale-stock visibility

Test input:

```
stock = 1
checkout A opens one-unit Sales Order
Zoho Items endpoint deliberately remains stale at stock = 1
item lock is released
checkout B requests the same final unit
```

Expected: checkout B is blocked by the strongly-consistent website reservation ledger even though the Zoho Items field is stale.

Result: **PASS**.

The reservation ledger is a safety bridge, not a second inventory database. It expires automatically, is released on deterministic rollback, and is shortened after confirmed payment. Zoho remains the accounting/inventory source of truth.

## Static/build validation

- `public/script.js`: syntax PASS.
- `netlify/functions/zoho-integration.js`: syntax PASS.
- `netlify/functions/cleanup-expired-checkouts.js`: syntax PASS.
- `scripts/verify-build.js` checks required deployment files, JavaScript syntax and presence of `@netlify/blobs.getStore`.
- `package.json` pins `@netlify/blobs` to `10.7.13`.
- Node engine pinned to `20.x`; `.nvmrc` contains `20`.
- `netlify.toml` has explicit build command, publish directory and Functions directory.
- Stock display code does not import or call Netlify Blobs.
- No live Zoho/PayPal secrets are included in the deployment project.

## Production-only checks still required

Mocked integration tests can prove code-path behavior but cannot prove third-party production infrastructure. After GitHub → Netlify deployment, perform:

1. Netlify build succeeds and prints `Vestige deployment preflight passed.`
2. Protected `connection_test` reports the correct organization and five real item IDs/stock values.
3. `checkoutStorage.ok`, `strongConsistency` and `atomicConditionalWrites` are all `true`.
4. Confirm the five permanent `ZOHO_ITEM_*_ID` values in Netlify environment variables.
5. Set `ZOHO_LOCATION_ID` if only one Zoho location should fulfil website orders.
6. Perform one controlled real PayPal purchase from product selection through Customer Payment PDF receipt.
7. Confirm Zoho contains one Customer, one Sales Order, one Invoice and one successful Customer Payment for that checkout — not duplicates.

The design is fail-safe rather than literally infallible: if Zoho, PayPal, Netlify or the network is unavailable, checkout should stop without overselling stock, duplicating financial documents or accepting unverified payment.
