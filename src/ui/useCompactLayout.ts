import { useEffect, useState } from 'react';

/** Layout follows the usable viewport, including a phone rotated to landscape. */
export function useCompactLayout() {
  const [compact, setCompact] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 960px)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(max-width: 960px)');
    const sync = () => setCompact(query.matches);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      if (viewport && viewport.scale !== 1) return;
      document.documentElement.style.setProperty(
        '--app-height',
        `${Math.round(viewport?.height ?? window.innerHeight)}px`,
      );
    };
    resize();
    viewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return compact;
}
