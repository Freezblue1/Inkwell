import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box } from '@mui/material';

/**
 * Mounts children only once they come near the viewport (and keeps them
 * mounted afterwards). Used to keep long scrivenings documents fast.
 */
export function LazyMount({ children, placeholderHeight, rootMargin = '1200px 0px' }: { children: ReactNode; placeholderHeight: number; rootMargin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return <Box ref={ref}>{visible ? children : <Box sx={{ height: placeholderHeight }} aria-hidden />}</Box>;
}
