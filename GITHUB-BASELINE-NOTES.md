# GitHub source-control notes

- Do not commit the original Cloudflare recovery ZIP, `production-version.json`, `production-worker.raw`, or deployment-history capture to the public repository.
- The source package contains only the deployable recovered source and intentionally excludes captured runtime values/secrets.
- Recommended history:
  1. Commit `Vestige-V35.28.4-Reconstructed` as branch `v35.28.4-production-recovery` and tag `V35.28.4`.
  2. Commit `Vestige-V35.28.5` separately as branch `v35.28.5-development`.
  3. Do not merge/deploy V35.28.5 until `npm install`, `npm run check`, and `npm run dry-run` pass locally and the Cloudflare preview has been regression-tested.
