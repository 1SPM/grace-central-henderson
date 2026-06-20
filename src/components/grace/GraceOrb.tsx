type GraceOrbSize = 'xs' | 'sm' | 'md' | 'sb' | 'lg';

interface GraceOrbProps {
  size?: GraceOrbSize;
  /** Show animated pulsating halo rings. */
  rings?: boolean;
  className?: string;
}

const WAVE_SPAN_COUNT = 7;

export function GraceOrb({ size = 'md', rings = false, className = '' }: GraceOrbProps) {
  return (
    <div
      className={`grace-orb grace-orb--${size}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label="GRACE"
    >
      {rings && (
        <>
          <div className="grace-orb__halo grace-orb__halo--outer" />
          <div className="grace-orb__halo" />
        </>
      )}
      <div className="grace-orb__core">
        <div className="grace-orb__mist" />
        <div className="grace-orb__wave" aria-hidden="true">
          {Array.from({ length: WAVE_SPAN_COUNT }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
