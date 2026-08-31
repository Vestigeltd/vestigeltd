# V22 GitHub → Netlify production checklist

## 1. Commit the repository root as supplied
Do not move `package.json` or `netlify.toml` into `public/`.

Expected Netlify build:
- Build command: `npm run build`
- Publish directory: `public`
- Functions directory: `netlify/functions`
- Node: 20.x

A successful build log must contain:

```
Vestige deployment preflight passed.
```

## 2. Netlify environment variables
Set real values only in Netlify Project configuration → Environment variables.

Required:
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_ORGANIZATION_ID=935297724`
- `ZOHO_ADMIN_TEST_KEY`
- `CHECKOUT_SIGNING_SECRET`
- `ZOHO_ACCOUNTS_URL=https://accounts.zoho.com`
- `ALLOWED_ORIGIN=https://vestigeltd.netlify.app`

Pin these after the first successful connection test:
- `ZOHO_ITEM_BLUEBERRY_MINT_ID`
- `ZOHO_ITEM_MIAMI_MINT_ID`
- `ZOHO_ITEM_BLUE_RAZZ_ICE_ID`
- `ZOHO_ITEM_STRAWBERRY_KIWI_ICE_ID`
- `ZOHO_ITEM_WATERMELON_ICE_ID`
- `ZOHO_ITEM_COURIER_LOCKER_ID`

If all website stock is fulfilled from one Zoho location, set:
- `ZOHO_LOCATION_ID`

Do **not** create manual Netlify Blob access-token/site-ID environment variables for Functions. Netlify supplies Blob runtime context automatically.

## 3. Run the protected connection test
PowerShell example:

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "X-Vestige-Admin-Key" = "YOUR_ZOHO_ADMIN_TEST_KEY"
}
$body = @{ action = "connection_test" } | ConvertTo-Json
Invoke-RestMethod `
    -Method Post `
    -Uri "https://vestigeltd.netlify.app/api/zoho" `
    -Headers $headers `
    -Body $body
```

Do not paste the admin key into chat or commit it to GitHub.

Healthy output must report:
- the correct Zoho organization;
- five BC10000 item IDs and stock values;
- Courier Guy item rate R60;
- `checkoutStorage.ok = true`;
- `checkoutStorage.strongConsistency = true`;
- `checkoutStorage.atomicConditionalWrites = true`;
- all three Blob stores healthy: checkouts, reservations, locks.

## 4. Pin the returned Zoho item IDs
Copy each returned production item ID into the corresponding Netlify environment variable. Redeploy after changing environment variables.

## 5. Controlled live purchase
Use one in-stock flavour and quantity 1.

Verify in Zoho Books:
1. one customer record (created or updated);
2. one Sales Order with `WEB-<checkoutId>` reference;
3. Sales Order status Open / subsequently invoiced;
4. exact product line R300 and Courier line R60;
5. one invoice total R360;
6. partial payments disabled;
7. PayPal online payment recorded successfully;
8. invoice Paid with R0 balance;
9. website confirms only after Zoho payment verification;
10. payment receipt PDF downloads successfully.

## 6. Concurrency check
With a test flavour temporarily set to one sellable unit, use two browser sessions and submit nearly simultaneously. Only one transaction should obtain the stock reservation. Restore the real stock level afterward.

## 7. Security
Never commit:
- `.env`
- Zoho client secret / refresh token
- checkout signing secret
- admin test key
- PayPal credentials
- `node_modules`

If any real secret was ever committed to a public repository, rotate it rather than merely deleting the file from the latest commit.
