# Vestige V35.23.2 — Final Release Candidate

## Release identity
- Release: V35.23.2
- Protected live baseline: V35.16.0
- Cloudflare Worker name: `vestigeltd`
- D1 database: `vestige-checkout`
- D1 database ID: `da38e52e-adc9-407a-8cf9-6f4b59821f4b`
- Worker entry point: `src/worker.js`
- Assets directory: `public/`
- Cron: every 15 minutes

## Promotion rule
This release is designed to be promoted into the existing V35.16.0 Cloudflare project directory. The Cloudflare identity is defined by `wrangler.toml`, not by the local Windows folder name. The V35.23.2 candidate and the supplied V35.16.0 project use the same Worker name, D1 database name/ID, asset binding, compatibility settings and cron schedule.

Do NOT create a new Worker, change the Worker name, create a new D1 database, or change existing production secrets merely to install this release.

## Safe promotion
1. Make a complete backup of the existing working project folder.
2. Preserve local `.wrangler/`, `node_modules/`, and any local-only environment material.
3. Overlay the V35.23.2 application files.
4. Preserve the existing Cloudflare bindings and secrets.
5. Run `npm run verify`.
6. Run `npx wrangler deploy --dry-run` from the Windows project folder.
7. Create a preview-only Worker version.
8. Browser-test normal stock and controlled all-zero stock.
9. Confirm pending-payment recovery is never obscured.
10. Do not deploy to production until the owner explicitly approves.

## Important evidence boundaries
The project register confirms the D1 cleanup state but does not prove Zoho Books test-invoice cleanup. Zoho Books must be audited separately.

The local test suite passing does not substitute for a successful networked Wrangler dry-run or fresh Cloudflare preview.

## Hardening intentionally not forced into this release
Analytics rate limiting and collection-code brute-force throttling require an explicit production edge/rate-limit design. They should not be implemented by guessing at Cloudflare account capabilities or introducing an unvalidated D1 throttle into the payment-critical path. They remain the next hardening task after the release gate.

## Versioning
Application asset cache-busting references are preserved exactly as supplied by the verified V35.23.2 candidate. Historical version references are retained because the existing regression suite treats some of them as controlled compatibility evidence.

## Integrity
This package was built from the verified V35.23.2 candidate whose source archive SHA-256 was recorded as:
`8395d90b5d6af0bce8bc0dc0ad193c48b2a339e9501e6ebeb444c4675dcfc04e`
