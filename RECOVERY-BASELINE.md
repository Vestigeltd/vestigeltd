# Vestige V35.28.4 recovered production baseline

Source of truth: Cloudflare Worker version `ec7a8878-2d5f-4127-9a7e-6810234d4ab5` plus the verified live static asset graph recovered on 2026-09-19.

- Production Worker bundle was downloaded from Cloudflare and extracted as `src/worker.js`.
- Static assets were recovered from `https://vestigeltd.co.za` and reference-validated.
- Cloudflare-injected Browser Insights beacon tags were removed because they are edge-generated, not source.
- Runtime secrets and the Cloudflare recovery metadata are deliberately excluded from this source tree.
- 14 edge-injected beacon tag(s) were removed from recovered HTML.

This directory is an immutable recovery baseline. Develop from a copy only.
