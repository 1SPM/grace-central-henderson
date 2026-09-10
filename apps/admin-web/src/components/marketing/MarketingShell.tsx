import type { ReactNode } from 'react';

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-page font-web text-central-black min-h-screen">
      {children}
    </div>
  );
}
