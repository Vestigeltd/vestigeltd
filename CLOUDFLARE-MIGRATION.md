# Vestige Vapes — Cloudflare migration

This port uses the newer v22 checkout logic as the baseline because it contains additional stock reservation and checkout-storage integrity protections that are absent from the supplied v19 `repo.zip`.

## Cloudflare replacements
- Netlify Functions -> Cloudflare Worker (`src/worker.js`)
- Netlify Blobs strong-consistency stores -> Cloudflare D1 (`CHECKOUT_DB`)
- Netlify scheduled function -> Worker Cron Trigger every 15 minutes
- Netlify static publish directory -> Workers Static Assets (`public/`)
- `/api/zoho` Netlify redirect -> native Worker route

## Required secrets / variables
Configure these in Cloudflare Worker Settings > Variables and Secrets. Secrets should be encrypted secrets, not plaintext variables where possible:
- ZOHO_CLIENT_ID
- ZOHO_CLIENT_SECRET
- ZOHO_REFRESH_TOKEN
- ZOHO_ORGANIZATION_ID
- CHECKOUT_SIGNING_SECRET (minimum 32 unpredictable bytes)
- ZOHO_ADMIN_TEST_KEY

Optional/installation-specific:
- ZOHO_ACCOUNTS_URL
- ALLOWED_ORIGIN
- ZOHO_LOCATION_ID
- ZOHO_ITEM_BLUEBERRY_MINT_ID
- ZOHO_ITEM_MIAMI_MINT_ID
- ZOHO_ITEM_BLUE_RAZZ_ICE_ID
- ZOHO_ITEM_STRAWBERRY_KIWI_ICE_ID
- ZOHO_ITEM_WATERMELON_ICE_ID
- ZOHO_ITEM_COURIER_LOCKER_ID

## One-time D1 setup
1. Create a D1 database named `vestige-checkout` in Cloudflare.
2. Copy its database ID into `wrangler.toml`, replacing `REPLACE_WITH_D1_DATABASE_ID`.
3. Apply migration `0001_checkout_storage.sql` to the remote D1 database.
4. Deploy only after the migration succeeds.

## Deployment safety
Deploy to a test Worker/branch first. Run `connection_test`, availability, checkout creation, duplicate-submit, insufficient-stock, payment, payment-verification and expiry-cleanup tests before routing real customers to it.
