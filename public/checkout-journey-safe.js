/* V35.14.2a HARDENED CHECKOUT JOURNEY
   Isolated UX layer only.
   No age-gate, checkout, stock, Zoho, D1, payment or Owner logic is modified. */
(function () {
  'use strict';

  const STATE_KEY = '__vestigeStableJourneyBoundV35142a';

  function byId(id) {
    return document.getElementById(id);
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           Number(style.opacity || 1) !== 0 &&
           rect.width > 0 &&
           rect.height > 0;
  }

  function ageGateBlocking() {
    const explicit = [
      byId('ageGate'),
      byId('age-gate'),
      document.querySelector('.age-gate'),
      document.querySelector('.ageGate'),
      document.querySelector('[data-age-gate]'),
      document.querySelector('[data-agegate]')
    ].filter(Boolean);

    if (explicit.some(isVisible)) return true;

    // Defensive fallback: only treat a visible modal/dialog as the age gate if
    // its text clearly references legal age/adult access.
    const dialogs = Array.from(document.querySelectorAll(
      '[role="dialog"], dialog, .modal, .overlay, [aria-modal="true"]'
    ));
    return dialogs.some(el => {
      if (!isVisible(el)) return false;
      const text = String(el.textContent || '').toLowerCase();
      return text.includes('adult access') ||
             text.includes('legal age') ||
             text.includes('legally permitted');
    });
  }

  function findShopForm() {
    const flavour = byId('flavourSelect');
    if (!flavour) return null;
    return flavour.closest('form') || document.querySelector('#buy-now form');
  }

  function ensureJourney() {
    const form = findShopForm();
    if (!form) return null;

    let wrap = byId('vestigeCheckoutJourney');
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.id = 'vestigeCheckoutJourney';
    wrap.className = 'vestige-checkout-journey-safe';
    wrap.setAttribute('aria-label', 'Checkout progress');
    wrap.innerHTML = `
      <aside class="vcjs-process" aria-label="Checkout stages">
        <div class="vcjs-step is-current" data-step="1">
          <span>1</span><div><strong>Choose</strong><small>Flavour & quantity</small></div>
        </div>
        <i aria-hidden="true"></i>
        <div class="vcjs-step" data-step="2">
          <span>2</span><div><strong>Details</strong><small>Basket, delivery & customer</small></div>
        </div>
        <i aria-hidden="true"></i>
        <div class="vcjs-step" data-step="3">
          <span>3</span><div><strong>Payment</strong><small>Review & pay</small></div>
        </div>
      </aside>
      <aside class="vcjs-data" aria-label="Live basket summary">
        <div class="vcjs-selection" aria-live="polite">
          <div><span>Basket</span><strong id="vcsFlavour">Your basket is empty</strong></div>
          <div><span>Items</span><strong id="vcsQty">0</strong></div>
          <div><span>Products</span><strong id="vcsProducts">—</strong></div>
          <div><span>Delivery</span><strong id="vcsDelivery">—</strong></div>
          <div class="vcjs-selection-total"><span>Total</span><strong id="vcsTotal">—</strong></div>
        </div>
        <div class="vcjs-confidence">
          <span>✓ Live stock checked</span>
          <span>✓ Secure payment confirmation</span>
          <span>✓ Paid invoice issued after confirmation</span>
        </div>
        <p class="vcjs-selection-note" id="vcsNote">Choose a flavour and quantity, then add it to your basket.</p>
      </aside>
    `;

    const summary = byId('vestigeConversionSummary');
    if (summary && summary.parentElement === form) {
      form.insertBefore(wrap, summary);
    } else {
      form.insertBefore(wrap, form.firstChild);
    }

    let note = byId('vestigeCheckoutGuidance');
    if (!note) {
      note = document.createElement('p');
      note.id = 'vestigeCheckoutGuidance';
      note.className = 'vestige-checkout-guidance-safe';
      note.setAttribute('aria-live', 'polite');
      note.textContent = 'Choose your flavour and quantity to begin.';
      wrap.insertAdjacentElement('afterend', note);
    }

    return wrap;
  }

  function radioCheckedWithinForm(form, el) {
    if (!el.name) return el.checked;
    return Array.from(form.querySelectorAll('input[type="radio"]'))
      .some(r => r.name === el.name && r.checked);
  }

  function valuePresent(form, el) {
    if (!el || el.disabled) return true;
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'radio') return radioCheckedWithinForm(form, el);
    return String(el.value || '').trim() !== '';
  }

  function updateJourney() {
    if (ageGateBlocking()) return;

    const form = findShopForm();
    const journey = byId('vestigeCheckoutJourney') || ensureJourney();
    if (!form || !journey) return;

    let basketSummary = {};
    try { basketSummary = JSON.parse(form.dataset.basketSummary || '{}'); } catch (_) {}
    const selectionDone = Number(basketSummary.totalQuantity || 0) > 0;

    const requiredFields = Array.from(
      form.querySelectorAll('input[required],select[required],textarea[required]')
    ).filter(el => !['flavourSelect', 'quantity'].includes(el.id));

    const incomplete = requiredFields.filter(el => !valuePresent(form, el));
    const detailsDone = requiredFields.length > 0 && incomplete.length === 0;

    let current = 1;
    if (selectionDone) current = 2;
    if (selectionDone && detailsDone) current = 3;

    journey.querySelectorAll('.vcjs-step').forEach(step => {
      const n = Number(step.dataset.step);
      step.classList.toggle('is-current', n === current);
      step.classList.toggle('is-complete', n < current);
    });

    const note = byId('vestigeCheckoutGuidance');
    if (!note) return;

    let nextText;
    if (!selectionDone) {
      nextText = 'Choose a flavour and quantity to continue.';
    } else if (!detailsDone) {
      nextText = incomplete.length
        ? `${incomplete.length} required detail${incomplete.length === 1 ? '' : 's'} remaining.`
        : 'Complete your customer and delivery details.';
    } else {
      nextText = 'Your details are complete. Review your order and continue to payment.';
    }

    if (note.textContent !== nextText) note.textContent = nextText;
  }

  function bindPinnedGuide(journey) {
    let geometryFrame = 0;
    function syncPinnedGeometry() {
      geometryFrame = 0;
      const header = document.querySelector('.site-header');
      const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 82;
      journey.style.setProperty('--vcjs-sticky-top', headerHeight + 'px');
      if (!window.matchMedia('(min-width:900px)').matches) {
        journey.style.removeProperty('--vcjs-end-shift');
        return;
      }
      const processRail = journey.querySelector('.vcjs-process');
      const dataRail = journey.querySelector('.vcjs-data');
      const faq = byId('faq');
      const railHeight = Math.max(
        processRail ? processRail.getBoundingClientRect().height : 0,
        dataRail ? dataRail.getBoundingClientRect().height : 0
      );
      const clearance = faq ? faq.getBoundingClientRect().top - headerHeight - railHeight - 8 : 0;
      journey.style.setProperty('--vcjs-end-shift', Math.min(0, clearance) + 'px');
    }
    function requestPinnedGeometry() {
      if (geometryFrame) return;
      geometryFrame = window.requestAnimationFrame(syncPinnedGeometry);
    }
    window.addEventListener('scroll', requestPinnedGeometry, { passive: true });
    window.addEventListener('resize', requestPinnedGeometry);
    document.addEventListener('vestige:cart-updated', requestPinnedGeometry);
    syncPinnedGeometry();
  }

  function bindOnce() {
    if (window[STATE_KEY]) return true;
    if (ageGateBlocking()) return false;

    const form = findShopForm();
    if (!form) return false;

    window[STATE_KEY] = true;
    ensureJourney();
    bindPinnedGuide(byId('vestigeCheckoutJourney'));
    document.dispatchEvent(new CustomEvent('vestige:journey-ready'));
    updateJourney();

    // Deliberately no MutationObserver: avoids feedback loops.
    form.addEventListener('input', updateJourney);
    form.addEventListener('change', updateJourney);
    document.addEventListener('vestige:cart-updated', updateJourney);

    // Short finite reconciliation only for programmatic stock/preselection changes.
    let ticks = 0;
    const reconcile = window.setInterval(() => {
      ticks += 1;
      updateJourney();
      if (ticks >= 20) window.clearInterval(reconcile);
    }, 250);

    return true;
  }

  function start() {
    if (bindOnce()) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (bindOnce() || attempts >= 120) {
        window.clearInterval(timer);
      }
    }, 250);
  }

  // The age gate can legitimately remain open longer than the finite startup
  // reconciliation window. Re-run initialization immediately after the
  // existing legal-age entry control dismisses the gate.
  const enterSite = byId('enterSite');
  if (enterSite) {
    enterSite.addEventListener('click', () => window.setTimeout(start, 0));
  }

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
  }
})();
