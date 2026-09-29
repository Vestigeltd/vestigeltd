'use strict';
(() => {
  const gate=document.getElementById('ageGate');
  const enter=document.getElementById('enterSite');
  const leave=document.getElementById('leaveSite');

  try {
    if (sessionStorage.getItem('vestigeAgeAccepted') === '1') {
      document.documentElement.classList.add('vestige-age-accepted');
      if (gate) gate.classList.add('hidden');
    }
  } catch (_) {}

  if (enter) enter.addEventListener('click',()=>{
    try { sessionStorage.setItem('vestigeAgeAccepted','1'); } catch (_) {}
    document.documentElement.classList.add('vestige-age-accepted');
    if (gate) gate.classList.add('hidden');
  });

  if (leave) leave.addEventListener('click',()=>{
    window.location.href='https://www.google.com/';
  });
})();