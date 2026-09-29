'use strict';

/* Shared navigation behaviour only. Presentation belongs in HTML/CSS. */
(() => {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  if (!toggle || !nav) return;

  const close = () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  nav.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
})();

/* ELFA PRO live-stock behaviour. Do not move presentation concerns into this block. */
(() => {
  const ELFA_PRO_KEYS = Object.freeze({
    'peach-ice': 'elfa-pro:peach-ice',
    'spearmint': 'elfa-pro:spearmint',
    'miami-mint': 'elfa-pro:miami-mint',
    'grape': 'elfa-pro:grape',
    'watermelon': 'elfa-pro:watermelon'
  });

  const rangeCards = Array.from(document.querySelectorAll('.pod-flavour-card'));
  const pathMatch = window.location.pathname.match(/^\/elfa-pro\/([^/]+?)(?:\.html)?\/?$/i);
  const detailSlug = pathMatch ? String(pathMatch[1] || '').toLowerCase() : '';
  const detailProductKey = ELFA_PRO_KEYS[detailSlug] || '';

  if (!rangeCards.length && !detailProductKey) return;

  function stockState(item) {
    if (!item || !Number.isFinite(Number(item.stock))) {
      return { text: 'STOCK STATUS UNAVAILABLE', className: 'unavailable' };
    }
    const stock = Number(item.stock);
    if (stock > 0 && item.available !== false) {
      return { text: stock + ' IN STOCK', className: 'in-stock' };
    }
    return { text: 'OUT OF STOCK', className: 'out-of-stock' };
  }

  function applyBadgeState(badge, item) {
    if (!badge) return;
    const state = stockState(item);
    badge.classList.remove('pod-status', 'in-stock', 'out-of-stock', 'unavailable');
    badge.classList.add('flavour-stock-state', state.className);
    badge.textContent = state.text;
  }

  function prepareRangeCards() {
    rangeCards.forEach(card => {
      const href = card.getAttribute('href') || '';
      const match = href.match(/\/elfa-pro\/([^/?#]+?)(?:\.html)?(?:[?#].*)?$/i);
      const slug = match ? String(match[1] || '').toLowerCase() : '';
      const key = ELFA_PRO_KEYS[slug] || '';
      if (!key) return;
      card.dataset.productKey = key;
      const badge = card.querySelector('.pod-status, .flavour-stock-state');
      if (badge) {
        badge.classList.remove('pod-status');
        badge.classList.add('flavour-stock-state', 'unavailable');
        badge.textContent = 'CHECKING STOCK…';
      }
    });
  }

  function prepareDetailPage() {
    if (!detailProductKey) return null;
    const heroCopy = document.querySelector('.pod-detail-grid > div:first-child');
    const lede = heroCopy && heroCopy.querySelector('.hero-lede');
    let badge = heroCopy && heroCopy.querySelector('.flavour-page-stock');
    if (!badge && heroCopy && lede) {
      badge = document.createElement('span');
      badge.className = 'flavour-page-stock unavailable';
      badge.textContent = 'CHECKING STOCK…';
      lede.insertAdjacentElement('afterend', badge);
    }
    return badge;
  }

  function updateDetailStatus(item, badge) {
    if (!detailProductKey) return;
    applyBadgeState(badge, item);
    const state = stockState(item);

    document.querySelectorAll('.pod-fact-card dt').forEach(dt => {
      if ((dt.textContent || '').trim().toLowerCase() !== 'vestige status') return;
      const row = dt.parentElement;
      const dd = row && row.querySelector('dd');
      if (dd) dd.textContent = state.text;
    });

    const guard = document.querySelector('.pod-sale-guard');
    if (guard) {
      const strong = guard.querySelector('strong');
      const note = guard.querySelector('span');
      if (strong) strong.textContent = state.text + ' · R150.00';
      if (note) {
        note.textContent = state.className === 'in-stock'
          ? 'Live stock verified with Zoho Books.'
          : state.className === 'out-of-stock'
            ? 'This flavour is currently unavailable.'
            : 'Live stock could not be verified.';
      }
    }
  }

  prepareRangeCards();
  const detailBadge = prepareDetailPage();

  fetch('/api/zoho', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'availability' })
  })
    .then(response => {
      if (!response.ok) throw new Error('Stock request failed');
      return response.json();
    })
    .then(result => {
      const catalogue = result && result.catalogue ? result.catalogue : {};
      rangeCards.forEach(card => {
        const key = card.dataset.productKey || '';
        applyBadgeState(card.querySelector('.flavour-stock-state'), catalogue[key]);
      });
      if (detailProductKey) updateDetailStatus(catalogue[detailProductKey], detailBadge);
    })
    .catch(() => {
      rangeCards.forEach(card => applyBadgeState(card.querySelector('.flavour-stock-state'), null));
      if (detailProductKey) updateDetailStatus(null, detailBadge);
    });
})();
