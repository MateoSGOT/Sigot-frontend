// Fuente única de breakpoints para la lógica responsive en JS (matchMedia, etc.).
// DEBE coincidir con los @media del CSS y con --bp-* de variables.css.
//   móvil  < 640px
//   tablet 640–1023px
//   desktop ≥ 1024px
export const BP = { mobile: 640, tablet: 1024 };

export const mq = {
  mobile:  `(max-width: ${BP.mobile - 1}px)`, // < 640
  tablet:  `(max-width: ${BP.tablet - 1}px)`, // < 1024 (móvil + tablet)
  desktop: `(min-width: ${BP.tablet}px)`,     // ≥ 1024
};

// Hook ligero: devuelve true cuando la media query coincide (SSR-safe).
import { useEffect, useState } from 'react';
export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
