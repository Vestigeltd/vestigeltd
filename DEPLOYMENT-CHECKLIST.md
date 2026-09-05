# Vestige V35.23.2 — Cloudflare Release Checklist

## 1. Local verification

From the project root:

```text
npm ci
npm run verify
```

`npm run verify` must report:

```text
Vestige Cloudflare deployment preflight passed.
```

## 2. Cloudflare dry-run

Run on the owner's Windows machine:

```text
npx wrangler deploy --dry-run
```

Do not proceed if Wrangler reports a configuration, packaging or syntax error.

## 3. Preview validation

Deploy/upload a preview only after the dry-run succeeds.

Validate:

- `/`
- `/flavours/blueberry-mint`
- `/flavours/miami-mint`
- `/flavours/blue-razz-ice`
- `/flavours/strawberry-kiwi-ice`
- `/order-status`
- `/contact`
- `/owner`

## 4. Shop state validation

Verify both states:

- Normal in-stock Shop remains selectable and checkout-capable.
- When all five configured flavours report numeric stock `<= 0`, the Shop displays `Sold out` / `Will have stock soon`.
- Partial, missing or failed stock responses must never falsely report the entire Shop as sold out.
- An active/pending payment recovery journey must remain accessible.

## 5. Zoho and payment validation

Run the protected Owner Console health checks and audit Zoho Books separately.

For any controlled purchase, verify the complete chain:

1. Correct customer.
2. Correct product and quantity.
3. Correct pricing.
4. Correct delivery/collection treatment.
5. Correct Sales Order/invoice.
6. Payment verified by Zoho.
7. Website confirmation only after verification.
8. Correct reservation release/bridge behaviour.

## 6. Production approval

Production deployment requires:

- successful local verification;
- successful Windows Wrangler dry-run;
- successful preview;
- successful browser validation;
- successful Zoho audit;
- explicit owner approval.

**Never use a new Worker or new D1 database as a shortcut around a release problem.**
