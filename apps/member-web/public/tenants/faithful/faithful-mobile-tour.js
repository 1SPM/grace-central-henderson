/* Allowlisted navigation only; no visitor data enters Maya's demo. */
(() => {
  if(new URLSearchParams(location.search).get('tour')!=='1')return;
  function navigate(){const route=location.hash.slice(1);if(!['home','give','community','profile'].includes(route))return;window.enterApp?.('demo');window.showScreen?.(route);}
  window.addEventListener('hashchange',navigate);navigate();
})();
