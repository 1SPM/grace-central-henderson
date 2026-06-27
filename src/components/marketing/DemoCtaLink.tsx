import type { ReactNode } from 'react';
import { isDemoModeEnabled, navigateToDemoCrm } from '../../lib/demoEntry';

export function DemoCtaLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (isDemoModeEnabled) {
    return (
      <a
        href="#"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          navigateToDemoCrm();
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
