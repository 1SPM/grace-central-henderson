/* Ported from the redesign prototype — outline SVG icon set, 24x24. */
import type { JSX } from 'react';

export type IconName =
  | 'home' | 'users' | 'user' | 'calendar' | 'chat' | 'chart' | 'settings'
  | 'search' | 'plus' | 'arrow_up' | 'arrow_dn' | 'arrow_right' | 'arrow_left'
  | 'check' | 'x' | 'bell' | 'mail' | 'phone' | 'sparkle' | 'dollar' | 'grid'
  | 'filter' | 'dots' | 'star' | 'heart' | 'book' | 'pray' | 'logout' | 'sun' | 'music';

const PATHS: Record<IconName, JSX.Element> = {
  home: <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9z" />,
  users: (<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.6" /><path d="M15 20c0-2.4 1.8-4.2 4-4.4" /></>),
  user: (<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.4 3-6 7-6s7 2.6 7 6" /></>),
  calendar: (<><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>),
  chat: <path d="M21 12c0 4.4-4 8-9 8-1.3 0-2.5-.2-3.6-.6L4 21l.9-3.5C3.7 16.1 3 14.1 3 12c0-4.4 4-8 9-8s9 3.6 9 8z" />,
  chart: <path d="M4 20V8M10 20V4M16 20v-8M22 20H2" />,
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-3.5-3.5" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow_up: <path d="M7 14l5-5 5 5" />,
  arrow_dn: <path d="M7 10l5 5 5-5" />,
  arrow_right: <path d="M9 6l6 6-6 6" />,
  arrow_left: <path d="M15 6l-6 6 6 6" />,
  check: <path d="M5 12.5l4 4 10-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  bell: (<><path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15z" /><path d="M10 21a2 2 0 0 0 4 0" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6l8.5 7 8.5-7" /></>),
  phone: <path d="M5 4h3l1.5 4-2 1.5a12 12 0 0 0 6 6L15 14l4 1.5V18a2 2 0 0 1-2 2A14 14 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />,
  dollar: (<><path d="M12 3v18" /><path d="M16 7c-1-1.4-2.5-2-4-2-2.5 0-4 1.3-4 3s2 2.5 4 3 4 1.3 4 3-1.5 3-4 3c-1.5 0-3-.6-4-2" /></>),
  grid: (<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>),
  filter: <path d="M4 5h16l-6 7v6l-4-2v-4z" />,
  dots: (<><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>),
  star: <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" />,
  heart: <path d="M12 20s-7-4.3-7-9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 7 4.5C19 15.7 12 20 12 20z" />,
  book: (<><path d="M4 4v15a1 1 0 0 0 1 1h15V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z" /><path d="M4 19c0-1.7 1.3-3 3-3h13" /></>),
  pray: <path d="M9 21V14l-3-3V7l3-3 6 6v4l-3 3v4M15 14l3 3v3" />,
  logout: (<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 8l-4 4 4 4M6 12h13" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>),
  music: (<><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>),
};

export function Icon({ name, size = 18, className = 'icon' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`svg-icon ${className}`} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
