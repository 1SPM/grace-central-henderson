import { ReactNode } from 'react';

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-500">{children}</h2>
  );
}
