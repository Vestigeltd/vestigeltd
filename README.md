# Vestige Vapes V19 — adversarial transaction hardening

V19 is rebuilt from the attached V15 checkout and focuses on transaction integrity between the customer browser, Netlify Functions, Zoho Books Items/Contacts/Sales Orders/Invoices/Customer Payments, and PayPal.

## Core inventory rule
- Page load/reload and **Retry stock check** read all five BC10000 items from Zoho Books.
- Stable Zoho `item_id` values are used as product identity. Optional Netlify environment variables can pin the five IDs permanently.
- For multiple Zoho locations, one location must be able to fulfil the complete requested quantity. Stock from separate locations is never added together to manufacture availability.
- `location_available_stock` is preferred, then `location_actual_available_stock`, then `location_stock_on_hand` only as a compatibility fallback when the explicit available fields are absent.
- A configured `ZOHO_LOCATION_ID` is authoritative when supplied.
- The browser snapshot is only for customer UX. Immediately before creating a Sales Order, the server re-fetches the exact Zoho item ID and verifies active status, R300 price, location and quantity.
- A strongly-consistent Netlify Blob lock serializes checkout reservation by exact item ID across serverless instances.
- After creation, the Sales Order is explicitly moved to Open and Zoho inventory movement is re-read before a payment link is released.

## Transaction recovery / idempotency
Each browser checkout has a unique ID and a server-side SHA-256 fingerprint covering customer/contact, billing, Courier Locker, flavour, Zoho item ID, quantity and amount. Netlify Blobs stores transaction checkpoints using atomic conditional writes.

The same checkout can safely recover after a lost Zoho response. It cannot be replayed with changed order/customer information. Recovery searches the deterministic `WEB-<checkoutId>` Sales Order reference and existing linked invoice before creating another financial document.

## Payment controls
- Sales Order is opened before invoicing.
- Invoice is explicitly moved out of Draft to Sent before a payment link is issued.
- Partial payments are hard-disabled.
- Only approved HTTPS Zoho payment hosts are returned to the browser, including `zohosecurepay.com`.
- Final confirmation re-verifies the Sales Order product item ID/quantity/rate, invoice relationship and exact amount.
- Confirmation requires invoice status Paid, zero balance, one successful online Customer Payment for the exact amount, an online transaction ID, and no refund.
- Manual/cash payments, partial payments, multiple ambiguous payments, refunded payments and modified Sales Orders fail closed.
- The Customer Payment PDF is served as proof of payment; no duplicate Zoho Sales Receipt transaction is created on top of an invoice/payment.

## Abandoned checkout cleanup
The scheduled cleanup runs every 15 minutes. It scans a bounded 14-day invoice window using Zoho's documented `date_start` filter, locally selects `WEB-` invoices, and only voids unpaid transactions older than 60 minutes. Any payment evidence is preserved for manual review rather than automatically releasing stock.

## Netlify environment variables
Required:
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_ORGANIZATION_ID=935297724`
- `ZOHO_ADMIN_TEST_KEY`
- `CHECKOUT_SIGNING_SECRET` (minimum 32 unpredictable bytes/characters)
- `ZOHO_ACCOUNTS_URL=https://accounts.zoho.com`
- `ALLOWED_ORIGIN=https://vestigeltd.netlify.app`

Recommended item pins after a successful protected connection test:
- `ZOHO_ITEM_BLUEBERRY_MINT_ID`
- `ZOHO_ITEM_MIAMI_MINT_ID`
- `ZOHO_ITEM_BLUE_RAZZ_ICE_ID`
- `ZOHO_ITEM_STRAWBERRY_KIWI_ICE_ID`
- `ZOHO_ITEM_WATERMELON_ICE_ID`
- `ZOHO_ITEM_COURIER_LOCKER_ID`

Optional:
- `ZOHO_LOCATION_ID` — strongly recommended if website stock should come from one specific Zoho location.

## Deployment prerequisite
V19 adds `@netlify/blobs` as a server dependency, so deploy the ZIP/package as a normal Netlify project and allow Netlify to install `package.json` dependencies. Do not upload `node_modules` or any `.env` containing live secrets.

See `TEST-VALIDATION.md` for the executed adversarial test matrix.
