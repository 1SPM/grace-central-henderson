const CIRCLE_TONES = {
  violet: 'from-violet-500 to-indigo-500',
  sky: 'from-sky-500 to-indigo-500',
  emerald: 'from-emerald-500 to-teal-500',
  orange: 'from-orange-500 to-amber-500',
} as const;

export type CountCircleTone = keyof typeof CIRCLE_TONES;

/** Big numbered gradient circle used by the Brief's stacked count cards. */
export function CountCircle({ value, tone = 'violet' }: { value: number; tone?: CountCircleTone }) {
  return (
    <span
      className={`w-10 h-10 rounded-full bg-gradient-to-br ${CIRCLE_TONES[tone]} grid place-items-center text-base font-semibold text-white shrink-0`}
    >
      {value}
    </span>
  );
}
