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
