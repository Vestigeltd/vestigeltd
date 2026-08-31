# V19 adversarial checkout validation

The attached V15 transaction engine was deliberately attacked and then rebuilt. Tests execute the actual V19 Netlify function with deterministic mocked Zoho Books/PayPal responses and a strongly-consistent in-memory implementation of the Netlify Blob conditional-write semantics used by production.

## Backend transaction tests — 32/32 passed
1. Expired Zoho access token is refreshed after an API 401.
2. All five products resolve; blank primary-location stock can use a valid secondary location.
3. A Zoho variant exposing only `location_stock_on_hand` remains compatible.
4. Browser-total tampering is rejected before a financial transaction.
5. A flavour paired with the wrong Zoho item ID is rejected.
6. Valid checkout creates one Sales Order, opens it, creates a Sent invoice, disables partial payments and returns a secure payment URL.
7. Identical checkout retry replays the existing transaction rather than duplicating it.
8. Changed order using the same checkout ID is rejected.
9. Unpaid invoice cannot confirm.
10. Manual/cash payment without online transaction evidence cannot confirm.
11. Refunded online payment cannot confirm.
12. Exact successful online payment confirms.
13. Verified Customer Payment receipt PDF is returned.
14. Existing customer billing update preserves existing shipping address.
15. Zoho product-price mismatch disables/prevents the order.
16. Negative available stock fails closed.
17. Lost Sales Order create response is recovered without creating a second Sales Order.
18. Lost invoice create response is recovered without creating a second invoice.
19. Two concurrent buyers attacking the final unit cannot both reserve it.
20. Zero stock cannot create a Sales Order.
21. Stock split 3 + 3 across two locations cannot fulfil a quantity-5 order from a fictitious combined pool.
22. `available_stock = 0` overrides higher physical stock and blocks the order.
23. A configured web-stock location cannot borrow stock from another Zoho location.
24. Item becoming inactive after page load is caught by final server validation.
25. Price changing after page load is caught by final server validation.
26. Deleted/stale browser item ID becomes a 409 refreshable catalogue conflict rather than a server crash.
27. Failed checkout ID cannot be reused with different customer/order data.
28. Lost customer-create response recovers by email without duplicating the customer.
29. Legitimate `https://zohosecurepay.com/...` URL is accepted.
30. Lookalike malicious payment hostname is rejected and unpaid Zoho documents are rolled back.
31. Sales Order product tampering after checkout blocks payment confirmation.
32. Multiple/ambiguous successful payments do not auto-confirm a full-payment-only order.

## Frontend purchasing tests — 17/17 passed
- Page load performs the availability request.
- Out-of-stock option is disabled.
- In-stock option is enabled.
- Changing flavour or quantity does not issue extra stock requests.
- R300 product arithmetic and R60 delivery arithmetic are correct.
- Valid verified selection enables Continue.
- `prepare_order` automatically retries transient network/503 failures with the same checkout ID.
- Exact Zoho item ID and server-expected total are sent.
- Payment panel appears only after order preparation.
- Receipt panel appears only after payment confirmation.
- Requested quantity above the page-load stock snapshot disables submission without an extra API call.
- Stock failure messaging remains customer-readable.

## Abandoned transaction tests — 5/5 passed
- Expired unpaid invoice is voided.
- Any invoice with payment evidence is preserved for manual review.
- Paid invoice is preserved.
- Sales Order is voided only after the invoice is safely voided.
- Cleanup uses Zoho's documented `date_start` query and does not use the unsupported `reference_number_startswith` filter.

## Static validation
- `public/script.js`: Node syntax PASS.
- `netlify/functions/zoho-integration.js`: Node syntax PASS.
- `netlify/functions/cleanup-expired-checkouts.js`: Node syntax PASS.
- No real Zoho OAuth credentials are included in the project.
- Netlify rate limiting remains configured on `/api/zoho`.
- Checkout signing secret is required to contain at least 32 bytes of unpredictable server-only data.

## Live-system limitation
These tests prove code-path behavior under simulated Zoho/PayPal responses. A genuine production guarantee cannot be made without deploying and executing a controlled live transaction against organization `935297724`, the real Netlify Blob service, current Zoho stock, and the configured PayPal gateway. The design intentionally fails closed when those external systems cannot be verified.
