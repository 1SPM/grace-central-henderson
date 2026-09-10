import { Radio } from 'lucide-react';
import type { ServiceTime } from '../../hooks/useChurchSettings';
import type { ActiveServiceSlot } from '../../lib/services/liveService';

interface OnlineSchedulePanelProps {
  serviceTimes: ServiceTime[];
  activeSlot: ActiveServiceSlot | null;
  churchName: string;
}

function groupByDay(serviceTimes: ServiceTime[]): Record<string, ServiceTime[]> {
  const order = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const grouped: Record<string, ServiceTime[]> = {};
  for (const st of serviceTimes) {
    if (!grouped[st.day]) grouped[st.day] = [];
    grouped[st.day].push(st);
  }
  return Object.fromEntries(
    order.filter(d => grouped[d]).map(d => [d, grouped[d]]),
  );
}

function isActiveSlot(st: ServiceTime, activeSlot: ActiveServiceSlot | null): boolean {
  if (!activeSlot) return false;
  return st.day === activeSlot.day && st.time === activeSlot.time;
}

export function OnlineSchedulePanel({
  serviceTimes,
  activeSlot,
  churchName,
}: OnlineSchedulePanelProps) {
  const grouped = groupByDay(serviceTimes);

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-dark-100 mb-4">
        Church online schedule
      </h2>

      <div className="rounded-xl overflow-hidden bg-gradient-to-r from-gray-900 via-red-950 to-gray-900 text-white px-5 py-4 mb-4">
        <p className="text-sm font-semibold">Join us online</p>
        <p className="text-xs text-white/70 mt-0.5">
          Saturday &amp; Sunday experiences — {churchName}
        </p>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([day, slots]) => (
          <div key={day}>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-400 mb-2">
              {day}s
            </h3>
            <div className="space-y-2">
              {slots.map(st => {
                const active = isActiveSlot(st, activeSlot);
                return (
                  <div
                    key={`${st.day}-${st.time}`}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                      active
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                        : 'bg-white dark:bg-dark-850 border-gray-100 dark:border-dark-700'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-semibold ${active ? 'text-emerald-800 dark:text-emerald-300' : 'text-gray-900 dark:text-dark-100'}`}>
                        {st.time} {st.name}
                      </p>
                    </div>
                    {active && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase">
                        <Radio size={8} className="animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
