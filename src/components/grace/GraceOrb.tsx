type GraceOrbSize = 'xs' | 'sm' | 'md' | 'lg';
type GraceOrbVariant = 'sunrise' | 'blue';

const SIZE_PX: Record<GraceOrbSize, number> = {
  xs: 28,
  sm: 40,
  md: 72,
  lg: 160,
};

interface GraceOrbProps {
  size?: GraceOrbSize;
  /** Show concentric glow rings (brand header). */
  rings?: boolean;
  variant?: GraceOrbVariant;
  className?: string;
}

export function GraceOrb({ size = 'md', rings = false, variant = 'sunrise', className = '' }: GraceOrbProps) {
  const px = SIZE_PX[size];
  const isBlue = variant === 'blue';

  return (
    <div
      className={`relative flex-shrink-0 rounded-full overflow-hidden ${className}`}
      style={{ width: px, height: px }}
    >
      {rings && (
        <>
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: isBlue
                ? '0 0 0 2px rgba(147,197,253,0.45), 0 0 0 7px rgba(147,197,253,0.18)'
                : '0 0 0 2px rgba(147,197,253,0.35), 0 0 0 6px rgba(147,197,253,0.15)',
            }}
          />
          <div
            className="absolute -inset-2 rounded-full pointer-events-none"
            style={{
              boxShadow: isBlue
                ? '0 0 28px 6px rgba(96,165,250,0.28)'
                : '0 0 24px 4px rgba(147,197,253,0.2)',
            }}
          />
        </>
      )}
      <div
        className="absolute inset-0"
        style={{
          background: isBlue
            ? 'linear-gradient(180deg, #7eb8e8 0%, #a8d0ef 24%, #d8eaf8 46%, #eef6fc 58%, #b8d9f2 78%, #6aafdb 100%)'
            : 'linear-gradient(180deg, #b8cee0 0%, #d6dde0 28%, #ecd9b8 60%, #ecc28e 88%, #d99a64 100%)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: isBlue ? '18%' : '14%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: `${px * (isBlue ? 0.85 : 0.9)}px`,
          height: `${px * (isBlue ? 0.85 : 0.9)}px`,
          background: isBlue
            ? 'radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.45) 32%, rgba(255,255,255,0) 68%)'
            : 'radial-gradient(circle, rgba(255,235,180,0.95) 0%, rgba(255,220,150,0.55) 30%, rgba(255,220,150,0) 70%)',
          filter: 'blur(2px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: '38%',
          left: '-30%',
          width: `${px * 0.8}px`,
          height: `${px * 0.25}px`,
          background:
            'radial-gradient(ellipse, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)',
          filter: 'blur(8px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: '52%',
          right: '-25%',
          width: `${px * 0.7}px`,
          height: `${px * 0.22}px`,
          background:
            'radial-gradient(ellipse, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)',
          filter: 'blur(8px)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: '35%',
          background: isBlue
            ? 'linear-gradient(180deg, rgba(96,165,250,0) 0%, rgba(59,130,246,0.12) 65%, rgba(37,99,235,0.22) 100%)'
            : 'linear-gradient(180deg, rgba(160,110,70,0) 0%, rgba(120,80,50,0.18) 65%, rgba(80,55,40,0.32) 100%)',
        }}
      />
    </div>
  );
}
