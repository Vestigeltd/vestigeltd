# Vestige Website Operational Standard

## Current development baseline
- Visual / source baseline: V35.30.17
- Canonical shared presentation system: `public/site-system-v35.30.17.css`
- Cloudflare static assets: `public/`
- Worker source: `src/worker.js`

## Engineering rules
1. Source changes only. No runtime CSS/JS presentation patches.
2. Shared presentation belongs in the canonical site-system stylesheet.
3. Interactive JavaScript is reserved for genuine behaviour, not visual mutation.
4. Payment, PayPal, Zoho, checkout, fulfilment, age-gate and Owner Console logic are protected systems.
5. Every release runs `npm run check`, `npm run clean:check`, then `npm run dry-run`.
6. Every release is previewed before production.
7. Production deployment requires explicit owner approval.
8. Temporary update ZIPs, one-off apply scripts, `dist-check`, and unreferenced historical site-system stylesheets are not retained in the working project.
9. Recovery/baseline archives that are not update packages are preserved.
10. Git history is the rollback mechanism for development source.

## Workspace commands
- `npm run clean` â€” remove generated update packages, dry-run output and unreferenced historical site-system files.
- `npm run clean:check` â€” fail if disposable/generated workspace items remain.
- `npm run check` â€” application verification suite.
- `npm run dry-run` â€” Cloudflare deployment dry run.

## Release sequence
`clean -> check -> clean:check -> dry-run -> preview -> owner visual approval -> production approval -> production deploy`