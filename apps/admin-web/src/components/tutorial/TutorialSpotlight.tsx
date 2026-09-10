import { useState, useEffect, useCallback } from 'react';

interface TutorialSpotlightProps {
  targetElement: HTMLElement | null;
  padding?: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function TutorialSpotlight({ targetElement, padding = 8 }: TutorialSpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null);

  const updateRect = useCallback(() => {
    if (!targetElement) {
      setRect(null);
      return;
    }
    const r = targetElement.getBoundingClientRect();
    setRect({
      x: r.x - padding,
      y: r.y - padding,
      width: r.width + padding * 2,
      height: r.height + padding * 2,
    });
  }, [targetElement, padding]);

  // Track position with ResizeObserver + scroll
  useEffect(() => {
    if (!targetElement) {
      setRect(null);
      return;
    }

    updateRect();

    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(targetElement);

    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [targetElement, updateRect]);

  if (!rect) return null;

  return (
    <svg
      className="fixed inset-0 w-full h-full z-[60] pointer-events-none"
      style={{ transition: 'opacity 0.2s ease' }}
    >
      <defs>
        <mask id="tutorial-spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            rx="8"
            fill="black"
            style={{ transition: 'all 0.3s ease' }}
          />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.5)"
        mask="url(#tutorial-spotlight-mask)"
      />
      {/* Highlight border around cutout */}
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx="8"
        fill="none"
        stroke="rgba(99,102,241,0.5)"
        strokeWidth="2"
        style={{ transition: 'all 0.3s ease' }}
      />
    </svg>
  );
}
