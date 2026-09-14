# V35.28.1 Deployment Checklist

- [ ] V35.27.9 rollback sibling remains untouched.
- [ ] Run `VALIDATE-V35.28.1.cmd` and confirm **V35.28.1 VALIDATION PASSED**.
- [ ] Run `UPLOAD-V35.28.1-PREVIEW.cmd`.
- [ ] Record Worker Version ID and Version Preview URL.
- [ ] Confirm the Owner tab remains in its existing public navigation position.
- [ ] Confirm `/owner` returns `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`.
- [ ] Unlock the Owner Console with the existing payment-admin key; no new password is required.
- [ ] Confirm Business Intelligence switches correctly between Today, 7 days and 30 days.
- [ ] Confirm the poll appears only when every current shop flavour has verified zero stock.
- [ ] Select multiple poll checkboxes and submit once; confirm no name, e-mail or mobile field exists.
- [ ] Refresh Customer Restock Demand in the Owner Console and verify the aggregate ranking.
- [ ] Confirm normal in-stock checkout, payment and stock behaviour remains unchanged.
- [ ] Verify `/bc10000` and `/bc10000/index.html` redirect to `/bc10000/`.
- [ ] Verify preview `X-Robots-Tag` remains `noindex, nofollow, noarchive, nosnippet`.
- [ ] Promote only the verified Version ID to 100% production.
