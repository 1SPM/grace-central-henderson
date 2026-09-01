/** SVG circular progress ring with a centered % label. */
export function ProgressRing({
  value,
  size = 48,
  stroke = 3.5,
  label,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  stroke?: number;
  /** Center label; defaults to "N%". */
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  return (
    <span
      className="relative grid place-items-center shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${clamped} percent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[11px] font-semibold text-slate-100">
        {label ?? `${clamped}%`}
      </span>
    </span>
  );
}
