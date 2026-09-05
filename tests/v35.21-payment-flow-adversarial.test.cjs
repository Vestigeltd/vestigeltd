'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'public', 'script.js'), 'utf8');
const paymentCss = fs.readFileSync(path.join(root, 'public', 'payment-visibility.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'src', 'zoho-integration.cjs'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

const checks = [
  [script.includes("BASKET_SESSION_KEY='vestigeBasketV1'"), 'Basket persistence key is missing.'],
  [script.includes('restoreBasketSession()'), 'Basket is not restored after refresh or flavour-page navigation.'],
  [script.includes('saveBasketSession();'), 'Basket changes are not persisted.'],
  [script.includes("form.addEventListener('submit'"), 'Reserve-basket submission handler is missing.'],
  [script.includes("form.classList.add('is-payment-mode')"), 'Payment mode does not isolate the completed form.'],
  [script.includes("form.classList.remove('is-payment-mode')"), 'Returning to the Shop cannot restore the form.'],
  [script.includes("document.documentElement.classList.add('vestige-payment-open')"), 'Stable payment viewport is not activated.'],
  [script.includes("document.documentElement.classList.remove('vestige-payment-open')"), 'Stable payment viewport cannot be released.'],
  [script.includes("activeCheckout.order.items.map"), 'Return-to-Shop cannot reconstruct the reserved basket.'],
  [script.includes('if(preserveBasket)cart=editableCart;else cart=[];'), 'Return and cancellation do not preserve/clear baskets separately.'],
  [script.includes("apiRequest({action:'cancel_bank_order'"), 'Return-to-Shop does not release the old stock reservation.'],
  [script.includes('resetCollectionAccess();'), 'A new checkout can incorrectly retain the old collection token.'],
  [script.includes("id=\"returnToShop\""), 'Payment page is missing Return to shop & edit basket.'],
  [script.includes("role=\"tab\""), 'QR/EFT selectors are not exposed as tabs.'],
  [script.includes("role=\"tabpanel\""), 'QR/EFT payment objects are not exposed as tab panels.'],
  [script.includes("event.key==='ArrowRight'"), 'QR/EFT tabs lack keyboard navigation.'],
  [script.includes("document.execCommand('copy')"), 'Clipboard fallback is missing.'],
  [script.includes('visibleCopyValue(button,fallbackValue)'), 'Copy controls do not derive the exact adjacent visible value.'],
  [script.includes('clipboardMatches(value)'), 'Clipboard result is not checked where browser permissions allow it.'],
  [script.includes("if(verified===false)return failure()"), 'A detected clipboard mismatch can still be reported as copied.'],
  [script.includes('Your browser could not verify the copy'), 'Clipboard failure is not visible to the customer.'],
  [script.includes("if(preserveBasket){\n      var proceed=window.confirm"), 'Return-to-edit safety warning is missing.'],
  [!script.includes("'Cancel '+ref+' and clear your basket?'"), 'Customer cancellation still asks for confirmation.'],
  [script.includes("window.location.replace('/#top')"), 'Successful cancellation does not navigate directly to the BC10000 page.'],
  [script.includes("status.paymentClaimedAt&&status.ownerAlertStatus==='sent'"), 'Refresh does not restore the owner-alert state.'],
  [script.includes("paid.textContent='Retry payment notice'"), 'Failed owner alerts are not retryable.'],
  [script.includes("paid.textContent='Payment notice sent'"), 'Successful owner alerts are not visibly final.'],
  [paymentCss.includes('position: fixed;') && paymentCss.includes('overscroll-behavior: contain;'), 'Payment viewport is not stable while scrolling.'],
  [paymentCss.includes('max-width: 940px;'), 'Payment objects have no readable wide-screen limit.'],
  [paymentCss.includes('@media (max-width: 640px)'), 'Payment page lacks mobile safeguards.'],
  [index.includes('name="addressLine2" required=""'), 'Required suburb field is missing.'],
  [worker.includes('addressLine2.length < 2'), 'Backend does not enforce the required suburb.'],
  [worker.includes('ownerAlertStatus'), 'Status response omits owner-alert delivery state.'],
  [!script.slice(script.indexOf('function showBankPayment'), script.indexOf('function closePaymentView')).includes('scrollIntoView'), 'Opening payment still performs a jumpy scroll.'],
];

for (const [condition, message] of checks) assert(condition, message);

console.log(`V35.21.2 payment-flow adversarial checks passed (${checks.length} assertions).`);
