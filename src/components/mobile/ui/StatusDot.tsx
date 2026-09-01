const DOT_TONES = {
  ok: 'bg-emerald-400',
  attention: 'bg-orange-400',
  none: 'bg-slate-600',
} as const;

export type StatusDotTone = keyof typeof DOT_TONES;

export function StatusDot({ tone }: { tone: StatusDotTone }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_TONES[tone]}`} aria-hidden="true" />;
}
