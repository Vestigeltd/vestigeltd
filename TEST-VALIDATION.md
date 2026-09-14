# V35.27.8 Test Validation

The automated suite covers the inherited checkout/payment/stock/owner regressions plus V35.27.8 SEO hardening safeguards.

Required before preview upload:
- `npm run check`
- `npx wrangler deploy --dry-run`

The preview itself must then be checked for server-side noindex protection, canonical redirect behaviour and live D1-backed availability before production promotion.
