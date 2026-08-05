import React, { useEffect, useState } from 'react';

// Conteo animado de 0 → target (easeOutCubic). Respeta prefers-reduced-motion.
export function useCountUp(target, active, duration = 1300) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number' || Number.isNaN(target)) { setVal(0); return; }
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!active || reduce || target === 0) { setVal(target); return; }
    let raf; const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return val;
}

// value: número objetivo. format: (n) => string. Mientras loading, muestra `skeleton`.
export default function CountUp({
  value,
  loading = false,
  active = true,
  duration = 1300,
  format = (n) => Math.round(n).toLocaleString('es-CO'),
  skeleton = null,
}) {
  const n = useCountUp(loading ? 0 : (typeof value === 'number' ? value : 0), active && !loading, duration);
  if (loading) return skeleton;
  return <>{format(n)}</>;
}
