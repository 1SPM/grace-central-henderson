/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Subtle neutral dark palette (zinc-based)
        dark: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          750: '#2e2e33',
          800: '#27272a',
          850: '#1f1f23',
          900: '#18181b',
          950: '#09090b',
        },
        // Professional slate-navy accent (replaces prior violet)
        accent: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
        },
        // Paper / parchment palette — warm neutral canvas
        paper: {
          canvas: '#ede8dc',   // body background (parchment)
          card:   '#faf7f0',   // cards, modals, stat cards
          raised: '#fdfbf5',   // inputs (subtly lighter than card)
          sink:   '#e4ddcd',   // sidebar, nested surfaces (deeper than canvas)
          line:   '#d6cfbd',   // visible borders on paper surfaces
        },
        // Ink — primary text + navy brand
        ink: {
          DEFAULT: '#1c2434', // body text, dark-slate navy
          900:     '#0f172a', // deepest (blue-950 territory)
          800:     '#1e3a8a', // brand navy (blue-900) — CTAs, active nav
          700:     '#1e40af', // hover on brand navy
        },
        // --- Monday-inspired reskin ---------------------------------------
        // The overrides below remap Tailwind's built-in palettes so the
        // hardcoded classes across components (bg-stone-100, border-gray-200,
        // indigo accents, status chips) pick up the Monday aesthetic globally.
        // Surfaces: cool near-white neutrals (replaces warm stone)
        stone: {
          50:  '#FCFCFE',
          100: '#F6F7FB',
          200: '#ECEEF6',
          300: '#D0D4E4',
          400: '#C3C6D4',
          500: '#9699A6',
          600: '#676879',
          700: '#50515F',
          800: '#393A45',
          900: '#2B2C35',
          950: '#1C1D25',
        },
        // Neutrals: Monday border + text grays
        gray: {
          50:  '#F9FAFD',
          100: '#F1F2F8',
          200: '#E6E9EF',
          300: '#D0D4E4',
          400: '#A8ABBD',
          500: '#676879',
          600: '#545566',
          700: '#424352',
          800: '#323338',
          900: '#1F2027',
          950: '#121319',
        },
        // Brand accent — CSS-variable driven so tenants can retheme at
        // RUNTIME (html[data-tenant] scope). Defaults (Monday purple
        // #6161FF) live in src/index.css :root; Faithful navy/sky overrides
        // in src/styles/faithful-crm-theme.css. Never fork this palette at
        // build time (see June 2026 Faithful regression).
        // GRACE SaaS brand — the product's own navy. Fixed across ALL
        // tenants (defaults in src/styles/grace-tokens.css); tenant themes
        // must never override --twc-brand-*. Admin chrome uses this;
        // member-facing surfaces keep tenant palettes (rose/central-*).
        brand: {
          50:  'rgb(var(--twc-brand-50) / <alpha-value>)',
          100: 'rgb(var(--twc-brand-100) / <alpha-value>)',
          200: 'rgb(var(--twc-brand-200) / <alpha-value>)',
          300: 'rgb(var(--twc-brand-300) / <alpha-value>)',
          400: 'rgb(var(--twc-brand-400) / <alpha-value>)',
          500: 'rgb(var(--twc-brand-500) / <alpha-value>)',
          600: 'rgb(var(--twc-brand-600) / <alpha-value>)',
          700: 'rgb(var(--twc-brand-700) / <alpha-value>)',
          800: 'rgb(var(--twc-brand-800) / <alpha-value>)',
          900: 'rgb(var(--twc-brand-900) / <alpha-value>)',
          950: 'rgb(var(--twc-brand-950) / <alpha-value>)',
          sky: 'rgb(var(--twc-brand-sky) / <alpha-value>)',
        },
        indigo: {
          50:  'rgb(var(--twc-indigo-50) / <alpha-value>)',
          100: 'rgb(var(--twc-indigo-100) / <alpha-value>)',
          200: 'rgb(var(--twc-indigo-200) / <alpha-value>)',
          300: 'rgb(var(--twc-indigo-300) / <alpha-value>)',
          400: 'rgb(var(--twc-indigo-400) / <alpha-value>)',
          500: 'rgb(var(--twc-indigo-500) / <alpha-value>)',
          600: 'rgb(var(--twc-indigo-600) / <alpha-value>)',
          700: 'rgb(var(--twc-indigo-700) / <alpha-value>)',
          800: 'rgb(var(--twc-indigo-800) / <alpha-value>)',
          900: 'rgb(var(--twc-indigo-900) / <alpha-value>)',
          950: 'rgb(var(--twc-indigo-950) / <alpha-value>)',
        },
        // Status: vivid Monday green
        emerald: {
          50:  '#E6FAF1',
          100: '#CCF5E3',
          200: '#99EBC7',
          300: '#5CDFA6',
          400: '#2BD589',
          500: '#00CA72',
          600: '#00A85F',
          700: '#00854C',
          800: '#00693C',
          900: '#00552F',
          950: '#003D22',
        },
        // Status: vivid Monday red
        red: {
          50:  '#FFEBEE',
          100: '#FFD9DF',
          200: '#FFB3BF',
          300: '#FF8095',
          400: '#FF5C75',
          500: '#FF3D57',
          600: '#E02E47',
          700: '#BB2239',
          800: '#961B2E',
          900: '#7A1727',
          950: '#450A14',
        },
        rose: {
          50:  '#FFEBEE',
          100: '#FFD9DF',
          200: '#FFB3BF',
          300: '#FF8095',
          400: '#FF5C75',
          500: '#FF3D57',
          600: '#E02E47',
          700: '#BB2239',
          800: '#961B2E',
          900: '#7A1727',
          950: '#450A14',
        },
        // Central Henderson brand
        central: {
          red: '#EE2B37',
          'red-hover': '#d42530',
          black: '#000000',
          white: '#FFFFFF',
          grey: '#A7A9AC',
          canvas: '#f6f6f6',
          card: '#ffffff',
          line: '#e8e8e8',
        },
        amber: {
          50:  '#FFF6E8',
          100: '#FEEDD1',
          200: '#FEDCA4',
          300: '#FDC871',
          400: '#FDB953',
          500: '#FDAB3D',
          600: '#E89422',
          700: '#C17717',
          800: '#9A5D14',
          900: '#7D4C13',
          950: '#472A08',
        },
      },
      fontFamily: {
        sans: ['Figtree', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Figtree', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        // Monday aesthetic: headings render as bold geometric sans (kept the
        // `serif` key so existing font-serif/.serif usages restyle globally)
        serif: ['Poppins', 'Figtree', '-apple-system', 'system-ui', 'sans-serif'],
        editorial: ['Newsreader', 'Georgia', 'serif'],
        fraunces: ['Fraunces', 'Georgia', 'serif'],
        brand: ['Montserrat', 'Gotham', 'Arial', 'sans-serif'],
        web: ['Poppins', 'Arial', 'sans-serif'],
      },
      transitionDuration: {
        '120': '120ms',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glass-lg': '0 8px 32px rgba(0, 0, 0, 0.12)',
        'glass-inset': 'inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        'premium': '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.05)',
        'premium-lg': '0 2px 4px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 20px rgba(71, 85, 105, 0.12)',
        'glow-sm': '0 0 10px rgba(71, 85, 105, 0.08)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'marketing-fade-up': 'marketingFadeUp 0.7s ease-out both',
      },
      animationDelay: {
        '100': '100ms',
        '200': '200ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        marketingFadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
