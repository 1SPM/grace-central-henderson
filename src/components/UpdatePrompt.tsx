/* Small fixed banner that appears when a new service-worker build is ready.
   Ends the "I shipped but the open tab still shows the old build" lag.
   Renders globally (mounted in main.tsx) — independent of any route. */
import { useEffect, useState } from 'react';

export function UpdatePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | undefined;

    function attach(reg: ServiceWorkerRegistration) {
      const onStateChange = (sw: ServiceWorker) => () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) setShow(true);
      };
      const onUpdateFound = () => {
        const sw = reg.installing;
        if (sw) sw.addEventListener('statechange', onStateChange(sw));
      };
      reg.addEventListener('updatefound', onUpdateFound);
      // If a SW is already waiting (skipWaiting may have promoted it just now), prompt.
      if (reg.waiting && navigator.serviceWorker.controller) setShow(true);
      // Poll for updates so a long-open tab notices new deploys.
      pollId = setInterval(() => { reg.update().catch(() => { /* ignore */ }); }, 60_000);
    }

    navigator.serviceWorker.getRegistration().then(reg => {
      if (cancelled) return;
      if (reg) attach(reg);
    }).catch(() => { /* ignore */ });

    // If the controller changes (new SW took over), the new build is now active —
    // the page assets, however, were loaded by the old controller. Prompt to reload.
    const onControllerChange = () => setShow(true);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!show) return null;

  return (
    <div role="status" style={{
      position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      background: '#18181b', color: '#fff',
      borderRadius: 999,
      boxShadow: '0 8px 28px -8px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSize: 13, fontWeight: 500, letterSpacing: 0,
    }}>
      <span aria-hidden style={{
        width: 8, height: 8, borderRadius: 999, background: '#c79a3a',
        boxShadow: '0 0 0 3px rgba(199,154,58,0.25)',
      }} />
      <span>A new version of Grace is ready.</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginLeft: 4,
          background: '#fff', color: '#18181b',
          border: 0, borderRadius: 999,
          padding: '6px 12px', fontWeight: 600, cursor: 'pointer',
          font: 'inherit',
        }}
      >Reload</button>
      <button
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        style={{ background: 'transparent', color: 'rgba(255,255,255,0.65)', border: 0, padding: '4px 6px', cursor: 'pointer', font: 'inherit', fontSize: 16, lineHeight: 1 }}
      >×</button>
    </div>
  );
}
