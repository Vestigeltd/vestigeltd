(function () {
  'use strict';

  const GA_ID = 'G-PVE0JH5WX4';
  let initialized = false;

  function initAnalytics() {
    if (initialized) return;
    initialized = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };

    window.gtag('js', new Date());
    window.gtag('config', GA_ID);

    if (!document.querySelector('script[data-vestige-ga]')) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
      script.setAttribute('data-vestige-ga', '1');
      document.head.appendChild(script);
    }
  }

  const ageGate = document.getElementById('ageGate');

  if (!ageGate) {
    initAnalytics();
    return;
  }

  try {
    if (sessionStorage.getItem('vestigeAgeAccepted') === '1') {
      initAnalytics();
      return;
    }
  } catch (e) {}

  if (ageGate.classList.contains('hidden')) {
    initAnalytics();
    return;
  }

  const observer = new MutationObserver(function () {
    if (ageGate.classList.contains('hidden')) {
      observer.disconnect();
      initAnalytics();
    }
  });

  observer.observe(ageGate, {
    attributes: true,
    attributeFilter: ['class']
  });
})();
