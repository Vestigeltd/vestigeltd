'use strict';
(() => {
  const targets = [...document.querySelectorAll('[data-live-stock-flavour]')];
  if (!targets.length) return;
  const set = (el, text, state) => {
    el.textContent = text;
    el.classList.remove('in-stock','out-of-stock','unavailable');
    if (state) el.classList.add(state);
  };
  fetch('/api/zoho', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify({action:'availability'})
  }).then(async response => {
    if (!response.ok) throw new Error('availability unavailable');
    return response.json();
  }).then(result => {
    const availability = result && result.availability || {};
    targets.forEach(el => {
      const flavour = String(el.dataset.liveStockFlavour || '');
      const item = availability[flavour];
      if (!item || !Number.isFinite(Number(item.stock))) {
        set(el,'Stock status unavailable','unavailable');
      } else if (item.available && Number(item.stock) > 0) {
        set(el,`${Number(item.stock)} in stock`,'in-stock');
      } else {
        set(el,'OUT OF STOCK','out-of-stock');
      }
    });
  }).catch(() => targets.forEach(el => set(el,'Stock status unavailable','unavailable')));
})();
