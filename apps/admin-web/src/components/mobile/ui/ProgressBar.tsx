/** Thin gradient progress bar. */
export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-400"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
