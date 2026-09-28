'use strict';

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

/* V35.30.6 shared header mark: one approved asset and size system across pages using site-nav. */
(() => {
  const logo = document.querySelector('.site-header .brand-logo');
  if (logo) {
    logo.src = '/assets/vestige-header-logo-dark-v35.30.6.webp';
    logo.alt = 'Vestige Ltd logo';
    logo.width = 471;
    logo.height = 361;
  }
  if (!document.getElementById('vestigeHeaderLogoStandard')) {
    const style = document.createElement('style');
    style.id = 'vestigeHeaderLogoStandard';
    style.textContent = '.site-header .brand-logo{width:56px!important;height:56px!important;flex:0 0 56px!important;object-fit:contain!important;background:#fff!important;padding:0!important}@media(max-width:980px){.site-header .brand-logo{width:50px!important;height:50px!important;flex-basis:50px!important}}@media(max-width:760px){.site-header .brand-logo{width:44px!important;height:44px!important;flex-basis:44px!important}}';
    document.head.appendChild(style);
  }
})();

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

  if (rangeCards.length && !document.getElementById('elfaProUniformStockLayout')) {
    const style = document.createElement('style');
    style.id = 'elfaProUniformStockLayout';
    style.textContent = [
      '.pod-flavour-card>.flavour-stock-state{position:absolute;top:14px;left:14px;right:auto;z-index:5;margin:0;max-width:calc(100% - 28px);}',
      '.pod-flavour-card .pod-card-meta{display:block;width:100%;}',
      '.pod-flavour-card .pod-card-copy>em{display:block;width:100%;margin-top:12px;padding-top:2px;text-align:right;line-height:1.45;}'
    ].join('');
    document.head.appendChild(style);
  }

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
    badge.classList.remove('in-stock', 'out-of-stock', 'unavailable');
    badge.classList.add(state.className);
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
        const badge = card.querySelector('.flavour-stock-state');
        applyBadgeState(badge, catalogue[key]);
      });
      if (detailProductKey) updateDetailStatus(catalogue[detailProductKey], detailBadge);
    })
    .catch(() => {
      rangeCards.forEach(card => applyBadgeState(card.querySelector('.flavour-stock-state'), null));
      if (detailProductKey) updateDetailStatus(null, detailBadge);
    });
})();

/* V35.30.6 corporate source-fidelity refinements. */
(() => {
  if (!document.body.classList.contains('corporate-home')) return;

  const title = document.getElementById('corporateTitle');
  if (title) {
    title.innerHTML = '<span>Superior delivery</span><span>begins with how</span><span>requirements are handled.</span>';
  }

  const brandMark = document.querySelector('.corporate-brand-mark');
  if (brandMark) {
    brandMark.src = '/assets/vestige-header-logo-dark-v35.30.6.webp';
    brandMark.alt = 'Vestige Limited logo';
    brandMark.width = 471;
    brandMark.height = 361;
  }

  const artwork = document.querySelector('.vestige-standard-artwork');
  if (artwork) {
    artwork.src = '/assets/vestige-standard-approved.webp';
    artwork.removeAttribute('srcset');
    artwork.removeAttribute('sizes');
    artwork.width = 556;
    artwork.height = 556;
  }

  const cardHeadings = [
    'Understanding the requirements.',
    'Utilising controlled processes',
    'Exact details matter',
    'Client consideration'
  ];
  document.querySelectorAll('.corporate-standard-grid article h3').forEach((heading, index) => {
    if (cardHeadings[index]) heading.textContent = cardHeadings[index];
  });

  document.querySelectorAll('.capability-card').forEach(card => {
    if (card.querySelector(':scope > .capability-kicker')) return;
    const index = card.querySelector(':scope > .capability-index');
    const eyebrow = card.querySelector(':scope > .eyebrow');
    if (!index || !eyebrow) return;
    const kicker = document.createElement('div');
    kicker.className = 'capability-kicker';
    card.insertBefore(kicker, index);
    kicker.append(index, eyebrow);
  });

  const fulcrum = document.querySelector('.avenue-fulcrum');
  if (fulcrum && !fulcrum.querySelector('.avenue-symbol-label')) {
    const label = document.createElement('span');
    label.className = 'avenue-symbol-label';
    label.textContent = 'DISCIPLINE · PRECISION';
    fulcrum.appendChild(label);
  }

  const experience = document.querySelector('.experience-visual');
  if (experience) {
    experience.className = 'experience-visual experience-map-visual';
    experience.setAttribute('role', 'img');
    experience.setAttribute('aria-label', "World map representing Vestige's international professional experience");
    experience.innerHTML = '<img class="experience-map-owner" src="/assets/world-map-owner-v35.30.6.webp" alt="Political world map showing countries and regions across the globe" width="797" height="510" loading="lazy" decoding="async"><span class="experience-coordinate">INTERNATIONAL PROFESSIONAL EXPERIENCE</span>';
  }
})();
