# Vestige Ltd — V35.23.2 Cloudflare Operational Project

This is the clean operational project for the Vestige Ltd website and checkout system.

## Cloudflare identity — DO NOT CHANGE

- Worker: `vestigeltd`
- D1 database: `vestige-checkout`
- D1 database ID: `da38e52e-adc9-407a-8cf9-6f4b59821f4b`
- D1 binding: `CHECKOUT_DB`
- Assets binding: `ASSETS`
- Worker entry: `src/worker.js`
- Static assets: `public/`
- Migrations: `migrations/`

The project must continue using the existing Worker and existing D1 database. Do not create replacement infrastructure.

## Verification

Use Node 22+.

```text
npm ci
npm run verify
npx wrangler deploy --dry-run
```

Do not production-deploy until the dry-run, preview, browser checks, Zoho audit and owner approval are complete.

## Release validation

Validate:

1. Normal in-stock Shop.
2. All-stock sold-out state.
3. Partial/missing/error inventory responses do not falsely mark the entire Shop sold out.
4. Pending payment and payment recovery remain accessible.
5. Owner Console authentication and operational actions.
6. Zoho Books inventory, invoice and payment integrity.
7. Mobile and desktop presentation.

## Security

Do not commit secrets. Do not bypass payment, inventory, reservation, authentication or concurrency controls to simplify the code.

The original uploaded operational archive is the recovery source. This clean package intentionally removes historical editing scripts, deprecated Netlify material, caches and backup copies from the operational directory.
