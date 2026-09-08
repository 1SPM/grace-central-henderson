import { useEffect, useRef, useState } from 'react';

/** Extracted from components/marketing/ValueCalculator.tsx, unchanged
 *  behavior — that component still uses it, now via this shared file,
 *  and WorkshopEvidencePage uses it too so its stat tiles visibly roll
 *  toward a new value on each poll refresh instead of snapping. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Rolls the displayed value toward `target` instead of snapping — the
 *  cause-and-effect between an underlying number changing and the
 *  display updating should feel visible, not instant. */
export function useCountUp(target: number): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    fromRef.current = shownRef.current;
    const from = fromRef.current;
    const t0 = performance.now();
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    function step(now: number) {
      const k = Math.min(1, (now - t0) / 350);
      const eased = 1 - Math.pow(1 - k, 3);
      const val = from + (target - from) * eased;
      shownRef.current = val;
      setShown(val);
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target, reduced]);

  return shown;
}
