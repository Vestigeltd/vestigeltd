# Vestige Vapes V22 — exact GitHub repository audit & Blob-safe Zoho checkout

V22 was rebuilt from the exact `Vestigeltd/vestigeltd` GitHub repository supplied by the site owner. The work focuses on the production boundary between the customer browser, Netlify Functions/Blobs and Zoho Books Items, Contacts, Sales Orders, Invoices and Customer Payments.

## What was wrong in the repository

The uploaded repository was structurally close to the hardened design, but the audit found several production risks:

1. **Product catalogue discovery still touched Netlify Blobs.** A Blob/runtime problem could add latency and failure noise to the most important customer operation: loading stock.
2. **Blob health was not tested by the protected `connection_test`.** A deployment could report Zoho healthy while distributed checkout storage was unusable.
3. **Blob failures after store creation could escape as generic HTTP 500 errors.** All Blob read/write failures are now normalized to a clear fail-closed HTTP 503 checkout-storage error.
4. **A subtle stock fallback could oversell.** If a location exposed physical stock but its location-level available fields were blank while the item-level `available_stock` was explicitly zero, the old fallback could treat physical stock as sellable. V22 caps/fails closed using explicit available stock.
5. **Opening a Sales Order was followed by an overly strict immediate Item-stock-decrease requirement.** Zoho treats an Open Sales Order as committed stock; the Items endpoint does not have to expose an instantaneous quantity decrease in the exact field the old code expected. V22 re-verifies the Open Sales Order and its exact item/quantity instead of breaking a valid purchase because of a lagging Items read.
6. **The canonical `/.netlify/functions/zoho-integration` route could bypass the rate-limited `/api/zoho` rewrite.** V22 accepts only the original incoming `/api/zoho` path. Netlify legacy Functions preserve the original incoming path in `event.path` when invoked through a rewrite.
7. **The Git repository did not have a build preflight.** V22 adds an explicit build command that fails deployment if the frontend/functions do not parse or `@netlify/blobs` is not actually installed.

## Stock architecture

Stock display is completely independent of Netlify Blobs.

```
Page load / refresh / Retry stock check
        ↓
/api/zoho
        ↓
Zoho Books Items
        ↓
exact Zoho item_id for each BC10000 flavour
        ↓
current available stock
        ↓
customer product selector
```

The browser's stock snapshot is only a customer-experience aid. When the customer submits the order, the backend silently re-fetches the exact selected Zoho `item_id` and validates:

- item exists and is active;
- item belongs to the selected flavour;
- rate remains exactly R300.00;
- one Zoho location can fulfil the complete requested quantity;
- requested quantity is still available.

Stock from separate Zoho locations is **never added together** to manufacture availability. If `ZOHO_LOCATION_ID` is configured, that one location is authoritative.

## Why Netlify Blobs remains in checkout

Blobs is no longer part of catalogue/stock display. It is retained only where distributed state is genuinely needed:

- atomic checkout idempotency/recovery;
- cross-instance lock by exact Zoho item ID;
- customer-update lock;
- transaction progress checkpoints;
- a short-lived per-item website reservation ledger that bridges delayed Zoho Items stock visibility.

This prevents two independent Netlify Function instances from both reserving the final unit. It also prevents a **sequential** second checkout from reselling the same final unit if Zoho has accepted the first Open Sales Order but the Items endpoint is briefly stale. Stores use strong consistency and atomic `onlyIfNew` / `onlyIfMatch` writes.

The reservation ledger does not replace Zoho inventory. It only places a conservative upper bound on sellable website stock while an unpaid website order is active (or for a short bridge after confirmed payment). Deterministic rollback removes its reservation; abandoned reservations age out automatically.

Before the protected `connection_test` reports the site healthy, V22 performs the same real atomic Blob test against **all three checkout stores** (`vestige-checkouts`, `vestige-stock-reservations`, and `vestige-stock-locks`):

1. atomic create;
2. strong read + ETag verification;
3. conditional update using that ETag;
4. strong read of the update;
5. cleanup.

If Blob storage is unavailable during checkout, V22 returns HTTP 503 **before customer/Sales Order/invoice writes occur**. Stock display continues to work because it never depends on Blobs.

## Sales Order / payment flow

```
Live final stock validation
        ↓
Atomic checkout + item lock
        ↓
Customer create/update
        ↓
Sales Order
        ↓
Sales Order explicitly marked OPEN
        ↓
Re-fetch Sales Order and verify exact item/quantity/status
        ↓
Invoice
        ↓
Partial payments disabled
        ↓
Invoice marked SENT
        ↓
Verify PayPal configured
        ↓
Approved HTTPS Zoho payment URL
        ↓
Customer pays
        ↓
Re-verify Sales Order + invoice + successful Customer Payment
        ↓
Order confirmed
        ↓
Customer Payment PDF receipt
```

The system does **not** create a second Zoho Sales Receipt transaction after an invoice/payment because that would represent the same sale twice. Proof of payment is the verified Zoho Customer Payment / paid-invoice chain and the Customer Payment PDF receipt.

## Payment confirmation requirements

Final confirmation requires all of the following:

- signed, unexpired checkout token;
- exact Sales Order and deterministic `WEB-<checkoutId>` reference;
- exact Zoho product `item_id`, quantity and R300 rate;
- correct invoice linked to the Sales Order;
- exact server-authoritative total (R300 × quantity + R60);
- partial payments disabled;
- invoice status Paid and balance R0.00;
- exactly one qualifying successful online Customer Payment for the exact amount;
- payment allocated to the exact invoice;
- online transaction ID present;
- no refund.

Manual/cash payments, partial payments, refunded payments, ambiguous multiple successful payments and altered Sales Orders fail closed.

## GitHub / Netlify deployment structure

Repository root:

```
package.json
netlify.toml
.nvmrc
.gitignore
.env.example
public/
netlify/functions/
scripts/verify-build.js
```

`package.json` pins `@netlify/blobs` to `10.7.13` and Node 20.x. `netlify.toml` runs `npm run build`, publishes `public`, bundles Functions with esbuild and explicitly externalizes `@netlify/blobs` for the Functions runtime.

Do **not** commit `node_modules`, `.env`, Zoho secrets or Netlify Blob credentials. Netlify supplies Blob site/auth context automatically to Functions.

## Required Netlify environment variables

- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_ORGANIZATION_ID=935297724`
- `ZOHO_ADMIN_TEST_KEY`
- `CHECKOUT_SIGNING_SECRET` — at least 32 unpredictable bytes/characters
- `ZOHO_ACCOUNTS_URL=https://accounts.zoho.com`
- `ALLOWED_ORIGIN=https://vestigeltd.netlify.app`

Strongly recommended permanent item pins:

- `ZOHO_ITEM_BLUEBERRY_MINT_ID`
- `ZOHO_ITEM_MIAMI_MINT_ID`
- `ZOHO_ITEM_BLUE_RAZZ_ICE_ID`
- `ZOHO_ITEM_STRAWBERRY_KIWI_ICE_ID`
- `ZOHO_ITEM_WATERMELON_ICE_ID`
- `ZOHO_ITEM_COURIER_LOCKER_ID`

Recommended if website stock should be fulfilled from one Zoho business location:

- `ZOHO_LOCATION_ID`

You do **not** need to create or hard-code a Netlify Blob token/site ID for normal Netlify Functions operation.

## OAuth scopes

The refresh token must include the scopes needed by the deployed operations, including Contacts, Sales Orders, Invoices, Items/settings reads and Customer Payment reads. If the existing refresh token was granted before these permissions were added, issue a new refresh token; scopes cannot be added to an already-issued refresh token.

## Production health test

After deployment run the protected `connection_test`. A healthy response must confirm:

- organization `935297724`;
- all five BC10000 item mappings and live stock values;
- Courier Guy service item and R60 rate;
- `checkoutStorage.ok = true`;
- `checkoutStorage.strongConsistency = true`;
- `checkoutStorage.atomicConditionalWrites = true`.

Only after that should a controlled live PayPal purchase be performed.

See `TEST-VALIDATION.md` for the executed V22 adversarial suite.
