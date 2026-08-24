type GraceOrbSize = 'xs' | 'sm' | 'md' | 'sb' | 'lg';

interface GraceOrbProps {
  size?: GraceOrbSize;
  /** Show animated pulsating halo rings. */
  rings?: boolean;
  /** Actively recording voice input — warmer glow, faster pulse. */
  listening?: boolean;
  className?: string;
}

const WAVE_SPAN_COUNT = 7;

export function GraceOrb({ size = 'md', rings = false, listening = false, className = '' }: GraceOrbProps) {
  return (
    <div
      className={`grace-orb grace-orb--${size}${listening ? ' grace-orb--listening' : ''}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={listening ? 'GRACE — listening' : 'GRACE'}
    >
      {(rings || listening) && (
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
