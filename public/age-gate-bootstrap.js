'use strict';
(() => {
  try {
    if (sessionStorage.getItem('vestigeAgeAccepted') === '1') {
      document.documentElement.classList.add('vestige-age-accepted');
    }
  } catch (_) {}
})();