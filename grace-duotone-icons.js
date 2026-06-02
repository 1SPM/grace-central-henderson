/* Faithful Church — duotone icon system (navy #1B2A4A + gold #C9973A) */
(function (global) {
  const NAVY = '#1B2A4A';
  const GOLD = '#C9973A';

  function c(variant, role) {
    const inv = variant === 'inverse';
    if (role === 'navy') return inv ? '#fff' : NAVY;
    if (role === 'gold') return GOLD;
    if (role === 'nFill') return inv ? 'rgba(255,255,255,.18)' : NAVY;
    if (role === 'gFill') return inv ? 'rgba(201,151,58,.35)' : GOLD;
    return NAVY;
  }

  function svgPaths(name, v) {
    const ns = c(v, 'navy');
    const gs = c(v, 'gold');
    const nf = c(v, 'nFill');
    const gf = c(v, 'gFill');

    const icons = {
      watch: `<circle cx="12" cy="12" r="9" fill="${nf}" opacity=".15"/><circle cx="12" cy="12" r="9" stroke="${ns}" stroke-width="1.8"/><path d="M10 8.5l6 3.5-6 3.5V8.5z" fill="${gs}"/>`,
      give: `<path d="M12 21S4.5 15.5 4.5 9.8a4 4 0 017.5-2.5 4 4 0 017.5 2.5C19.5 15.5 12 21 12 21z" fill="${gf}" opacity=".22"/><path d="M12 21S4.5 15.5 4.5 9.8a4 4 0 017.5-2.5 4 4 0 017.5 2.5C19.5 15.5 12 21 12 21z" stroke="${gs}" stroke-width="1.8"/><path d="M9.5 10.5h5M12 8v5" stroke="${ns}" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>`,
      prayer: `<path d="M12 5c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z" fill="${nf}" opacity=".15"/><circle cx="12" cy="9" r="4" stroke="${ns}" stroke-width="1.8"/><path d="M7 19.5c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="${ns}" stroke-width="1.8" stroke-linecap="round"/><path d="M12 5L12.8 3M14.5 6.5L16 5M9.5 6.5L8 5" stroke="${gs}" stroke-width="1.2" stroke-linecap="round"/>`,
      groups: `<circle cx="9" cy="8" r="3" fill="${nf}" opacity=".15"/><circle cx="9" cy="8" r="3" stroke="${ns}" stroke-width="1.7"/><circle cx="16" cy="8" r="2.5" fill="${gf}" opacity=".2"/><circle cx="16" cy="8" r="2.5" stroke="${gs}" stroke-width="1.5"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" fill="${nf}" opacity=".08"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" stroke="${ns}" stroke-width="1.7" stroke-linecap="round"/><path d="M18 14c2 .8 3.2 2.4 3.5 4.5" stroke="${gs}" stroke-width="1.3" stroke-linecap="round"/>`,
      calendar: `<rect x="3" y="5" width="18" height="16" rx="2.5" fill="${nf}" opacity=".12"/><rect x="3" y="5" width="18" height="16" rx="2.5" stroke="${ns}" stroke-width="1.8"/><path d="M3 10h18" stroke="${ns}" stroke-width="1.4" opacity=".4"/><path d="M8 3v4M16 3v4" stroke="${gs}" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="15.5" r="1.2" fill="${gs}"/><circle cx="12" cy="15.5" r="1.2" fill="${ns}" opacity=".35"/>`,
      star: `<path d="M12 2l2.5 6H21l-5.2 3.8 2 6.2L12 14l-5.8 4 2-6.2L3 8h6.5L12 2z" fill="${gf}" opacity=".2"/><path d="M12 2l2.5 6H21l-5.2 3.8 2 6.2L12 14l-5.8 4 2-6.2L3 8h6.5L12 2z" stroke="${gs}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10.5" r="2" fill="${ns}" opacity=".5"/>`,
      home: `<path d="M3 12L12 3l9 9v9H5V12z" fill="${nf}" opacity=".15"/><path d="M3 12L12 3l9 9" stroke="${ns}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="9" y="14" width="6" height="7" rx="1" fill="${gs}" opacity=".7"/><rect x="9" y="14" width="6" height="7" rx="1" stroke="${ns}" stroke-width="1.5"/>`,
      profile: `<circle cx="12" cy="7.5" r="3.8" fill="${nf}" opacity=".18"/><circle cx="12" cy="7.5" r="3.8" stroke="${ns}" stroke-width="1.8"/><path d="M4.5 21c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" fill="${gf}" opacity=".12"/><path d="M4.5 21c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" stroke="${ns}" stroke-width="1.8" stroke-linecap="round"/>`,
      bell: `<path d="M10 2a6 6 0 00-6 6v3l-1.5 2h15L16 11V8a6 6 0 00-6-6z" fill="${nf}" opacity=".15"/><path d="M10 2a6 6 0 00-6 6v3l-1.5 2h15L16 11V8a6 6 0 00-6-6z" stroke="${ns}" stroke-width="1.6"/><path d="M8.5 15a1.5 1.5 0 003 0" stroke="${gs}" stroke-width="1.5" stroke-linecap="round"/>`,
      brain: `<path d="M8 5c-2 0-3.5 1.8-3.5 4 0 1.2.5 2.2 1.2 3-.8.9-1.2 2-1.2 3.2 0 2.5 2 4.3 4.5 4.3.6 0 1.2-.1 1.7-.4.8 1.1 2.1 1.9 3.8 1.9 2.5 0 4.5-2 4.5-4.5 0-.5-.1-1-.2-1.4.9-.8 1.5-2 1.5-3.3C20 6.8 18 5 15.5 5c-1.2 0-2.3.4-3.2 1.1C11.4 5.4 10.2 5 9 5 8.6 5 8.3 5 8 5z" fill="${nf}" opacity=".15"/><path d="M8 5c-2 0-3.5 1.8-3.5 4 0 1.2.5 2.2 1.2 3-.8.9-1.2 2-1.2 3.2 0 2.5 2 4.3 4.5 4.3.6 0 1.2-.1 1.7-.4.8 1.1 2.1 1.9 3.8 1.9 2.5 0 4.5-2 4.5-4.5 0-.5-.1-1-.2-1.4.9-.8 1.5-2 1.5-3.3C20 6.8 18 5 15.5 5c-1.2 0-2.3.4-3.2 1.1C11.4 5.4 10.2 5 9 5 8.6 5 8.3 5 8 5z" stroke="${ns}" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 10h1.5M13.5 10H15M10.5 13h3" stroke="${gs}" stroke-width="1.2" stroke-linecap="round"/>`,
      people: `<circle cx="8.5" cy="8" r="3" fill="${nf}" opacity=".18"/><circle cx="8.5" cy="8" r="3" stroke="${ns}" stroke-width="1.8"/><circle cx="16" cy="8" r="2.2" fill="${gf}" opacity=".3"/><circle cx="16" cy="8" r="2.2" stroke="${gs}" stroke-width="1.5"/><path d="M2 20c0-3.2 2.9-5.5 6.5-5.5s6.5 2.3 6.5 5.5" fill="${nf}" opacity=".1"/><path d="M2 20c0-3.2 2.9-5.5 6.5-5.5s6.5 2.3 6.5 5.5" stroke="${ns}" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 13c1.9.8 3.2 2.4 3.5 4.5" stroke="${gs}" stroke-width="1.4" stroke-linecap="round"/>`,
      shield: `<path d="M12 3L5 6v5.5c0 4.2 3 8.1 7 9.5 4-1.4 7-5.3 7-9.5V6l-7-3z" fill="${nf}" opacity=".15"/><path d="M12 3L5 6v5.5c0 4.2 3 8.1 7 9.5 4-1.4 7-5.3 7-9.5V6l-7-3z" stroke="${ns}" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="${gs}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
      dollar: `<circle cx="12" cy="12" r="9" fill="${nf}" opacity=".12"/><circle cx="12" cy="12" r="9" stroke="${ns}" stroke-width="1.8"/><path d="M12 6v12M9.5 9c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 2-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5.9 2.5 2" stroke="${gs}" stroke-width="1.6" stroke-linecap="round"/>`,
      chat: `<path d="M5 5h14a2 2 0 012 2v7a2 2 0 01-2 2H9l-4 3v-3H5a2 2 0 01-2-2V7a2 2 0 012-2z" fill="${nf}" opacity=".15"/><path d="M5 5h14a2 2 0 012 2v7a2 2 0 01-2 2H9l-4 3v-3H5a2 2 0 01-2-2V7a2 2 0 012-2z" stroke="${ns}" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 10h8M8 13h5" stroke="${gs}" stroke-width="1.4" stroke-linecap="round"/>`,
      bible: `<path d="M6 4h12v16H6a2 2 0 01-2-2V6a2 2 0 012-2z" fill="${nf}" opacity=".12"/><path d="M6 4h12v16H6a2 2 0 01-2-2V6a2 2 0 012-2zm6 0v16" stroke="${ns}" stroke-width="1.8"/><path d="M9 9h3M9 12h4" stroke="${gs}" stroke-width="1.3" stroke-linecap="round"/>`,
      hospital: `<rect x="4" y="5" width="16" height="15" rx="2" fill="${nf}" opacity=".12"/><rect x="4" y="5" width="16" height="15" rx="2" stroke="${ns}" stroke-width="1.8"/><path d="M12 9v6M9 12h6" stroke="${gs}" stroke-width="1.6" stroke-linecap="round"/>`,
      crisis: `<path d="M12 3L20 19H4L12 3z" fill="${nf}" opacity=".15"/><path d="M12 3L20 19H4L12 3z" stroke="${ns}" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v4M12 16.5v.5" stroke="${gs}" stroke-width="1.6" stroke-linecap="round"/>`,
      food: `<path d="M4 14h16M6 14V9M10 14V7M14 14V7M18 14V9" stroke="${ns}" stroke-width="1.6" stroke-linecap="round"/><path d="M4 14h16l-1.5-5h-13L4 14z" fill="${gf}" opacity=".2"/><path d="M4 14h16l-1.5-5h-13L4 14z" stroke="${gs}" stroke-width="1.5" stroke-linejoin="round"/>`,
      counsel: `<circle cx="7" cy="9" r="2.8" fill="${nf}" opacity=".15"/><circle cx="7" cy="9" r="2.8" stroke="${ns}" stroke-width="1.5"/><circle cx="15" cy="9" r="2.3" fill="${gf}" opacity=".2"/><circle cx="15" cy="9" r="2.3" stroke="${gs}" stroke-width="1.3"/><path d="M3 18c0-2.2 1.8-4 4-4s4 1.8 4 4M13 18c0-1.8 1.5-3.2 3.2-3.2" stroke="${ns}" stroke-width="1.5" stroke-linecap="round"/>`,
      journal: `<rect x="5" y="3" width="14" height="18" rx="2" fill="${nf}" opacity=".12"/><rect x="5" y="3" width="14" height="18" rx="2" stroke="${ns}" stroke-width="1.8"/><path d="M9 8h6M9 12h6M9 16h4" stroke="${gs}" stroke-width="1.3" stroke-linecap="round"/>`,
      goals: `<circle cx="12" cy="12" r="8" fill="${nf}" opacity=".12"/><circle cx="12" cy="12" r="8" stroke="${ns}" stroke-width="1.8"/><circle cx="12" cy="12" r="4" stroke="${gs}" stroke-width="1.5"/><circle cx="12" cy="12" r="1.2" fill="${gs}"/>`,
      settings: `<circle cx="12" cy="12" r="3" fill="${gf}" opacity=".25"/><circle cx="12" cy="12" r="3" stroke="${gs}" stroke-width="1.4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="${ns}" stroke-width="1.6" stroke-linecap="round"/>`,
      card: `<rect x="3" y="6" width="18" height="12" rx="2" fill="${nf}" opacity=".12"/><rect x="3" y="6" width="18" height="12" rx="2" stroke="${ns}" stroke-width="1.8"/><path d="M3 10h18" stroke="${ns}" stroke-width="1.2" opacity=".35"/><rect x="6" y="13" width="5" height="2" rx=".5" fill="${gs}"/>`,
      impact: `<path d="M4 18V8l8-4 8 4v10" fill="${nf}" opacity=".1"/><path d="M4 18V8l8-4 8 4v10" stroke="${ns}" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 18v-5h6v5" stroke="${gs}" stroke-width="1.5" stroke-linejoin="round"/>`,
      wallet: `<rect x="3" y="7" width="18" height="12" rx="2.5" fill="${nf}" opacity=".12"/><rect x="3" y="7" width="18" height="12" rx="2.5" stroke="${ns}" stroke-width="1.8"/><circle cx="16" cy="13" r="1.5" fill="${gs}"/><path d="M3 11h18" stroke="${ns}" stroke-width="1.2" opacity=".35"/>`,
      church: `<path d="M12 3l2 3h4v3l-3 2v9H9V11L6 9V6h4l2-3z" fill="${nf}" opacity=".12"/><path d="M12 3l2 3h4v3l-3 2v9H9V11L6 9V6h4l2-3z" stroke="${ns}" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 14h4" stroke="${gs}" stroke-width="1.4" stroke-linecap="round"/>`,
      cross: `<path d="M12 4v16M7 9h10" stroke="${ns}" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" fill="${nf}" opacity=".08"/><circle cx="12" cy="12" r="9" stroke="${gs}" stroke-width="1.2" opacity=".5"/>`,
      fire: `<path d="M12 3c-1 3-4 4.5-4 8a4 4 0 008 0c0-2-1.5-3.5-2-5 1.5 1 2.5 2.5 2.5 4.5a2.5 2.5 0 01-5 0c0-2.5 2-4.5 2.5-7.5z" fill="${gf}" opacity=".25"/><path d="M12 3c-1 3-4 4.5-4 8a4 4 0 008 0c0-2-1.5-3.5-2-5 1.5 1 2.5 2.5 2.5 4.5a2.5 2.5 0 01-5 0c0-2.5 2-4.5 2.5-7.5z" stroke="${gs}" stroke-width="1.6" stroke-linejoin="round"/>`,
      ring: `<circle cx="12" cy="12" r="8" fill="none" stroke="${nf}" stroke-width="3" opacity=".2"/><circle cx="12" cy="12" r="8" fill="none" stroke="${gs}" stroke-width="3" stroke-dasharray="20 30" stroke-linecap="round" transform="rotate(-90 12 12)"/><circle cx="12" cy="12" r="3" fill="${ns}" opacity=".2"/>`,
      mic: `<rect x="9" y="3" width="6" height="11" rx="3" fill="${nf}" opacity=".15"/><rect x="9" y="3" width="6" height="11" rx="3" stroke="${ns}" stroke-width="1.8"/><path d="M6 11a6 6 0 0012 0M12 17v3" stroke="${gs}" stroke-width="1.6" stroke-linecap="round"/>`,
      send: `<path d="M4 16L16 4M10 4h6v6" stroke="${ns}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><path d="M4 16l4-4" stroke="${gs}" stroke-width="1.5" stroke-linecap="round"/>`,
      receive: `<path d="M16 4L4 16M10 16H4v-6" stroke="${ns}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><path d="M16 4l-4 4" stroke="${gs}" stroke-width="1.5" stroke-linecap="round"/>`,
      topup: `<path d="M12 5v14M5 12h14" stroke="${ns}" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="9" fill="${nf}" opacity=".08"/><circle cx="12" cy="12" r="9" stroke="${gs}" stroke-width="1.2" opacity=".6"/>`,
      lock: `<rect x="5" y="10" width="14" height="10" rx="2" fill="${nf}" opacity=".14"/><rect x="5" y="10" width="14" height="10" rx="2" stroke="${ns}" stroke-width="1.5"/><path d="M8 10V8a4 4 0 118 0v2" stroke="${gs}" stroke-width="1.6" stroke-linecap="round"/>`,
      help: `<circle cx="12" cy="12" r="8" fill="${nf}" opacity=".1"/><circle cx="12" cy="12" r="8" stroke="${ns}" stroke-width="1.5"/><path d="M12 16v-1M10.5 10.5a1.5 1.5 0 013 0c0 1-1.5 1.2-1.5 2.5" stroke="${gs}" stroke-width="1.5" stroke-linecap="round"/>`,
      signout: `<path d="M8 5H6a1.5 1.5 0 00-1.5 1.5v11A1.5 1.5 0 006 19h2" stroke="${ns}" stroke-width="1.5" stroke-linecap="round"/><path d="M13 12H4M16 9l3 3-3 3" stroke="${gs}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
      ai: `<path d="M12 2.5l2 5.5L20 10l-6 2.2L12 18l-2-5.8L4 10l6-2L12 2.5z" fill="${gf}" opacity=".25"/><circle cx="12" cy="10" r="2.5" fill="${gs}" opacity=".8"/><path d="M19 16l1 2.8 2.8 1L20 21l-1 2.5-1-2.5-2.8-1 2.8-1L19 16z" fill="${gs}" opacity=".9"/>`,
      leadership: `<path d="M12 2.5l2 5.5L20 10l-6 2.2L12 18l-2-5.8L4 10l6-2L12 2.5z" fill="${gf}" opacity=".2"/><path d="M12 2.5l2 5.5L20 10l-6 2.2L12 18l-2-5.8L4 10l6-2L12 2.5z" stroke="${ns}" stroke-width="1.5" stroke-linejoin="round"/>`,
      merchant: `<rect x="4" y="6" width="16" height="13" rx="2" fill="${nf}" opacity=".12"/><rect x="4" y="6" width="16" height="13" rx="2" stroke="${ns}" stroke-width="1.8"/><path d="M4 10h16" stroke="${ns}" stroke-width="1.2"/><path d="M8 14h2M12 14h4" stroke="${gs}" stroke-width="1.3" stroke-linecap="round"/>`,
      globe: `<circle cx="12" cy="12" r="9" fill="${nf}" opacity=".12"/><circle cx="12" cy="12" r="9" stroke="${ns}" stroke-width="1.8"/><path d="M3 12h18M12 3c2.5 2.8 4 6 4 9s-1.5 6.2-4 9M12 3c-2.5 2.8-4 6-4 9s1.5 6.2 4 9" stroke="${gs}" stroke-width="1.3" stroke-linecap="round"/>`,
      chevronDown: `<path d="M6 9l6 6 6-6" stroke="${ns}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      chevronUp: `<path d="M6 15l6-6 6 6" stroke="${ns}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      eye: `<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" fill="${nf}" opacity=".12"/><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" stroke="${ns}" stroke-width="1.8"/><circle cx="12" cy="12" r="2.5" fill="${gs}"/>`,
      amen: `<path d="M8 14V8l2-3 2 3v6M14 14V9l2-2 2 2v5" stroke="${ns}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 18h14" stroke="${gs}" stroke-width="1.4" stroke-linecap="round"/>`,
      heart: `<path d="M12 20s-6.5-4.5-6.5-9.2a3.5 3.5 0 016.5-2.2 3.5 3.5 0 016.5 2.2C18.5 15.5 12 20 12 20z" fill="${gf}" opacity=".22"/><path d="M12 20s-6.5-4.5-6.5-9.2a3.5 3.5 0 016.5-2.2 3.5 3.5 0 016.5 2.2C18.5 15.5 12 20 12 20z" stroke="${gs}" stroke-width="1.8"/>`,
      token: `<circle cx="12" cy="12" r="8" fill="${gf}" opacity=".25"/><circle cx="12" cy="12" r="8" stroke="${gs}" stroke-width="1.8"/><path d="M12 8v8M9 10h6M9 14h6" stroke="${ns}" stroke-width="1.3" stroke-linecap="round"/>`,
      sun: `<circle cx="12" cy="12" r="4" fill="${gf}" opacity=".35"/><circle cx="12" cy="12" r="4" stroke="${gs}" stroke-width="1.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="${ns}" stroke-width="1.5" stroke-linecap="round"/>`,
      moon: `<path d="M16 14a5 5 0 01-8-6 6 6 0 108-6 5 5 0 010 12z" fill="${nf}" opacity=".15"/><path d="M16 14a5 5 0 01-8-6 6 6 0 108-6 5 5 0 010 12z" stroke="${ns}" stroke-width="1.8"/>`,
      live: `<circle cx="12" cy="12" r="4" fill="${gs}"/><circle cx="12" cy="12" r="7" stroke="${ns}" stroke-width="1.5" opacity=".35"/>`,
      party: `<path d="M5 18l2-8 3 4 2-6 2 5 3-3 2 8H5z" fill="${gf}" opacity=".2"/><path d="M5 18l2-8 3 4 2-6 2 5 3-3 2 8H5z" stroke="${ns}" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 6l1 2M15 5l1 2M18 9l-2 1" stroke="${gs}" stroke-width="1.2" stroke-linecap="round"/>`,
      crown: `<path d="M5 16h14l-1-9-3 4-3-5-3 5-3-4-1 9z" fill="${gf}" opacity=".22"/><path d="M5 16h14l-1-9-3 4-3-5-3 5-3-4-1 9z" stroke="${gs}" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 16v2h8v-2" stroke="${ns}" stroke-width="1.4"/>`,
      package: `<rect x="5" y="7" width="14" height="12" rx="1.5" fill="${nf}" opacity=".12"/><rect x="5" y="7" width="14" height="12" rx="1.5" stroke="${ns}" stroke-width="1.8"/><path d="M5 11h14M12 7v4" stroke="${gs}" stroke-width="1.4" stroke-linecap="round"/>`,
      gas: `<rect x="6" y="5" width="8" height="14" rx="2" fill="${nf}" opacity=".12"/><rect x="6" y="5" width="8" height="14" rx="2" stroke="${ns}" stroke-width="1.8"/><path d="M16 9v8a2 2 0 002 2h0" stroke="${gs}" stroke-width="1.5" stroke-linecap="round"/><path d="M8 11h4" stroke="${ns}" stroke-width="1.2" stroke-linecap="round"/>`,
      dining: `<circle cx="12" cy="8" r="3" stroke="${ns}" stroke-width="1.6"/><path d="M6 20c0-3 2.7-5 6-5s6 2 6 5" stroke="${ns}" stroke-width="1.6" stroke-linecap="round"/><path d="M9 8V5M15 8V5" stroke="${gs}" stroke-width="1.3" stroke-linecap="round"/>`,
      travel: `<path d="M4 14l8-8 8 8H4z" fill="${nf}" opacity=".12"/><path d="M4 14l8-8 8 8H4z" stroke="${ns}" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 6v12" stroke="${gs}" stroke-width="1.4"/>`,
      edit: `<path d="M5 17l9-9 3 3-9 9H5v-3z" fill="${nf}" opacity=".12"/><path d="M5 17l9-9 3 3-9 9H5v-3z" stroke="${ns}" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 6l3 3" stroke="${gs}" stroke-width="1.5"/>`,
      share: `<path d="M14 5h5v5M10 14L19 5M6 10H4a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-2" stroke="${ns}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 5h5v5" stroke="${gs}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
      praise: `<path d="M12 3l2 4h4l-3.2 2.5 1.2 4.5L12 11.5 7.8 14l1.2-4.5L6 7h4l2-4z" fill="${gf}" opacity=".2"/><path d="M12 3l2 4h4l-3.2 2.5 1.2 4.5L12 11.5 7.8 14l1.2-4.5L6 7h4l2-4z" stroke="${gs}" stroke-width="1.5" stroke-linejoin="round"/>`,
      check: `<circle cx="12" cy="12" r="8" fill="${nf}" opacity=".12"/><path d="M8 12l2.5 2.5L16 9" stroke="${gs}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      close: `<path d="M8 8l8 8M16 8l-8 8" stroke="${ns}" stroke-width="2" stroke-linecap="round"/>`,
      resources: `<path d="M5 18V8l7-4 7 4v10" stroke="${ns}" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 14h6M12 10v8" stroke="${gs}" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="6" r="1.5" fill="${gs}"/>`,
      spark: `<path d="M12 2l1 4h4l-3 2.5 1 4.5-3-2.5-3 2.5 1-4.5-3-2.5h4l1-4z" fill="${gf}" opacity=".3"/><path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" fill="${gs}" opacity=".8"/>`,
      play: `<circle cx="12" cy="12" r="9" fill="${nf}" opacity=".15"/><path d="M10 8.5l6 3.5-6 3.5V8.5z" fill="${gs}"/>`
    };
    return icons[name] || icons.chat;
  }

  const EMOJI_MAP = {
    '\u{1F49B}': 'give', '\u{1F64F}': 'prayer', '\u{1F4C5}': 'calendar', '\u271D\uFE0F': 'cross', '\u271D': 'cross',
    '\u{1F6A8}': 'crisis', '\u{1F4D6}': 'bible', '\u25B6': 'play', '\u25B6\uFE0F': 'play', '\u25C7': 'groups',
    '\u{1F465}': 'groups', '\u{1F441}': 'eye', '\u{1F6D2}': 'merchant', '\u26FD': 'gas', '\u{1F4E6}': 'package',
    '\u{1F30D}': 'globe', '\u{1F338}': 'groups', '\u26A1': 'fire', '\u{1F534}': 'live', '\u{1F4E1}': 'resources',
    '\u{1F4EC}': 'chat', '\u{1F3A4}': 'mic', '\u{1F64C}': 'amen', '\u{1F4AC}': 'chat', '\u2764\uFE0F': 'heart',
    '\u2764': 'heart', '\u{1F389}': 'party', '\u{1F451}': 'crown', '\u{1F3C5}': 'star', '\u2600': 'sun',
    '\u263E': 'moon', '\u25CE': 'ring', '\u2713': 'check', '\u{1FA99}': 'token', '\u{1F512}': 'lock',
    '\u{1F33F}': 'ring', '\u{1F354}': 'dining', '\u2708\uFE0F': 'travel', '\u2708': 'travel', '\u{1F4DD}': 'journal',
    '\u{1F3AF}': 'goals', '\u{1F4B3}': 'card', '\u{1F4CA}': 'impact', '\u2699': 'settings', '\u{1F519}': 'signout',
    '\u270F\uFE0F': 'edit', '\u270F': 'edit', '\u{1F514}': 'bell', '\u2665\uFE0F': 'heart', '\u{1F6D2}': 'merchant',
    '\u{1F3AC}': 'watch', '\u{1F4E4}': 'share', '\u2728': 'spark',
    '\u2197': 'send', '\u2199': 'receive', '+': 'topup', '\uFF0B': 'topup'
  };

  function graceIcon(name, opts) {
    opts = opts || {};
    const size = opts.size || 22;
    const variant = opts.variant || 'default';
    const inner = svgPaths(name, variant);
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" class="grace-ic" aria-hidden="true">' + inner + '</svg>';
  }

  function graceIconTile(name, active, size) {
    size = size || 22;
    return '<span class="ic-tile' + (active ? ' ic-tile--active' : '') + '">' +
      graceIcon(name, { size: size, variant: active ? 'inverse' : 'default' }) + '</span>';
  }

  function graceIconRow(name, bg) {
    bg = bg || '#eef2f8';
    return '<span class="ic-row" style="background:' + bg + '">' + graceIcon(name, { size: 18 }) + '</span>';
  }

  function graceInline(name, label, opts) {
    opts = opts || {};
    const size = opts.size || 16;
    const variant = opts.variant || 'default';
    const html = graceIcon(name, { size: size, variant: variant });
    if (!label && label !== 0) return html;
    return '<span class="grace-inline">' + html + '<span>' + label + '</span></span>';
  }

  function emojiToIcon(text) {
    if (!text) return null;
    for (const emo in EMOJI_MAP) {
      if (text.indexOf(emo) !== -1) return EMOJI_MAP[emo];
    }
    return null;
  }

  function stripEmojiLabel(text) {
    return text.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u25CE\u25C7\u2713\u271D\u25B6\u25B6\uFE0F\uFE0F]/gu, '').replace(/^\s+/, '').trim();
  }

  function applyGraceIconEl(el, opts) {
    if (!el || el.dataset.graceDone === '1') return;
    opts = opts || {};
    let name = el.getAttribute('data-grace-icon') || opts.icon;
    const size = parseInt(el.getAttribute('data-grace-size') || opts.size || '16', 10);
    const variant = el.getAttribute('data-grace-variant') || opts.variant || 'default';
    const tile = el.hasAttribute('data-grace-tile') || opts.tile;
    const text = (el.textContent || '').trim();
    if (!name) name = emojiToIcon(text);
    if (!name) return;
    const label = opts.label != null ? opts.label : stripEmojiLabel(text);
    el.dataset.graceDone = '1';
    if (tile) {
      el.innerHTML = graceIconTile(name, el.hasAttribute('data-grace-active'), size);
      return;
    }
    if (!el.style.display || el.style.display === 'inline') el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.style.gap = el.style.gap || '6px';
    if (label) el.innerHTML = graceInline(name, label, { size: size, variant: variant });
    else {
      el.innerHTML = graceIcon(name, { size: size, variant: variant });
      el.style.justifyContent = 'center';
    }
  }

  function hydrateGraceIcons(root) {
    root = root || document;
    root.querySelectorAll('[data-grace-icon]').forEach(function (el) {
      applyGraceIconEl(el);
    });
  }

  function initGraceAllIcons(root) {
    root = root || document;
    if (typeof graceIcon !== 'function') return;

    const skip = '.chat-bubble, .post-body, .assigned-msg, .prof-j-text, textarea, input, script, style';
    const selectors = [
      '.home-qcmd', '.post-action', '.post-badge', '.assigned-btn', '.home-watch-btn',
      '.home-watch-play', '.home-watch-viewers', '.daily-time', '.daily-status',
      '.notif-ico', '.badge-ico', '.wact-ico', '.ios-row-icon', '.care-icon',
      '.home-impact-row > span:first-child', '.home-mod-title', '.home-ticker-item',
      '.nav-action', '.mchip-ico', '.act-ico', '.lf-ico', '.m-pact', '.m-comp-btn',
      '.mpc-pray-btn', '.qcmd-m', '.tile-ico', '.bc-btn', '.token-pill',
      '[data-grace-icon]', '#ld-pane-chat div[onclick*="mobSend"]',
      '.prof-spirit-card > div:first-child', '.goal-idea', '.mob-event-badge',
      '.home-pillar-badge', '.post-type-inline', '.grace-btn-icon',
      '.mob-event-rsvp', '.comm-dispatch-ico', '[data-grace-spark]'
    ].join(',');

    root.querySelectorAll(selectors).forEach(function (el) {
      if (el.closest(skip)) return;
      applyGraceIconEl(el, { size: el.classList.contains('wact-ico') ? 22 : el.classList.contains('badge-ico') ? 24 : 14 });
    });

    root.querySelectorAll('.mood-chip').forEach(function (chip) {
      const moodIcons = { Joyful: 'star', Peaceful: 'ring', Grateful: 'prayer', Thoughtful: 'brain', Struggling: 'crisis', Hopeful: 'fire' };
      const label = chip.querySelector('div:last-child');
      const ico = chip.querySelector('div:first-child');
      if (!label || !ico) return;
      const n = moodIcons[label.textContent.trim()];
      if (!n) return;
      ico.style.fontSize = '0';
      ico.innerHTML = graceIcon(n, { size: 22 });
    });

    root.querySelectorAll('.home-watch-btn-primary').forEach(function (btn) {
      applyGraceIconEl(btn, { icon: 'play', label: 'Watch Live', size: 14, variant: 'default' });
    });

    root.querySelectorAll('.chat-send').forEach(function (btn) {
      if (btn.textContent.trim() === '\u2191' || btn.textContent.trim() === '↑') {
        btn.innerHTML = graceIcon('send', { size: 18, variant: 'inverse' });
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
      }
    });

    root.querySelectorAll('.chat-input-bar button, .mic-btn-m, #m-mic').forEach(function (btn) {
      applyGraceIconEl(btn, { icon: 'mic', size: 20 });
    });
  }

  global.GRACE_BRAND = { navy: NAVY, gold: GOLD, cream: '#f5f0e8', tileBg: '#eef2f8' };
  global.graceIcon = graceIcon;
  global.graceIconTile = graceIconTile;
  global.graceIconRow = graceIconRow;
  global.graceInline = graceInline;
  global.graceEmojiToIcon = emojiToIcon;
  global.applyGraceIconEl = applyGraceIconEl;
  global.hydrateGraceIcons = hydrateGraceIcons;
  global.initGraceAllIcons = initGraceAllIcons;
})(typeof window !== 'undefined' ? window : global);
