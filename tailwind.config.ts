import type { Config } from 'tailwindcss';

/**
 * ITALPROTEIN CRM — design tokens.
 *
 * Semantic tokens (background/foreground/primary/…) are driven by CSS variables
 * declared in app/globals.css so the whole UI can be re-themed from one place and
 * a real backend / white-label layer can later swap palettes without code changes.
 *
 * Raw brand colours (navy / gold / teal / cream / sage / molecular) are exposed
 * directly for accents, charts and illustrations. Extracted from the official
 * Italprotein & Proamina® brand assets.
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      // Tighter gutter on phones; the flat 2rem ate a fifth of a 320px screen.
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        // ── semantic (CSS-variable driven) ──
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        // ── status (semantic operational colours) ──
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          subtle: 'hsl(var(--success-subtle))',
          // For success copy only — see the note in app/globals.css.
          text: 'hsl(var(--success-text))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          subtle: 'hsl(var(--warning-subtle))',
          // For warning copy only — see the note in app/globals.css.
          text: 'hsl(var(--warning-text))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          foreground: 'hsl(var(--danger-foreground))',
          subtle: 'hsl(var(--danger-subtle))',
          // For error copy only — see the note in app/globals.css.
          text: 'hsl(var(--danger-text))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          subtle: 'hsl(var(--info-subtle))',
          // For info copy only — see the note in app/globals.css.
          text: 'hsl(var(--info-text))',
        },
        // ── sidebar (internal CRM navy chrome) ──
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          muted: 'hsl(var(--sidebar-muted))',
          accent: 'hsl(var(--sidebar-accent))',
          border: 'hsl(var(--sidebar-border))',
          active: 'hsl(var(--sidebar-active))',
        },
        // ── raw brand palette (from official assets) ──
        brand: {
          // Exact navy sampled from the existing landing-page footer.
          navy: '#0A1628',
          navy800: '#0d1f38',
          navy700: '#112840',
          navy600: '#1b3a5b',
          blue: '#0284C7',
          blueBright: '#38BDF8',
          blueSoft: '#BAE6FD',
          yellow: '#FACC15',
          yellowStrong: '#EAB308',
          // Accent re-themed from gold → light blue (token names kept so the whole app re-themes from here).
          gold: '#38bdf8',
          goldLight: '#7dd3fc',
          goldDark: '#0284c7',
          teal: '#0eb89a',
          tealDark: '#0a9980',
          cream: '#f8f4ed',
          sage: '#6f8a6b',
          sageDark: '#566b53',
          molecular: '#2563eb',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'IBM Plex Sans Condensed', 'Arial Narrow', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(10 22 40 / 0.04)',
        sm: '0 1px 3px 0 rgb(10 22 40 / 0.06), 0 1px 2px -1px rgb(10 22 40 / 0.06)',
        DEFAULT: '0 2px 6px -1px rgb(10 22 40 / 0.08), 0 1px 4px -2px rgb(10 22 40 / 0.06)',
        md: '0 6px 16px -4px rgb(10 22 40 / 0.10), 0 2px 6px -2px rgb(10 22 40 / 0.06)',
        lg: '0 12px 32px -8px rgb(10 22 40 / 0.14), 0 4px 10px -4px rgb(10 22 40 / 0.08)',
        ring: '0 0 0 1px rgb(10 22 40 / 0.06)',
        'gold-glow': '0 0 24px rgb(56 189 248 / 0.40)',
        'blue-halo': '0 18px 55px -28px rgb(2 132 199 / 0.45)',
        'yellow-pin': '0 0 0 1px rgb(10 22 40 / 0.16), 0 0 16px rgb(250 204 21 / 0.28)',
      },
      // The site's signature ease, shared by the landing reveals and the motion
      // presets. Named here because the inline arbitrary value
      // `ease-[cubic-bezier(0.22,1,0.36,1)]` is ambiguous to Tailwind's parser.
      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        /* Gentler sibling of `float` for persistent chrome (the Amina launcher,
         * the hero bottle): −12px every 4s reads as bouncing on an element that
         * never leaves the screen, so this drifts a third of that, slower. */
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        /* Ambient breathing for large decorative glows. Opacity-only — a
         * transform here would repaint the whole hero band it sits behind. */
        breathe: {
          '0%, 100%': { opacity: '0.65' },
          '50%': { opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.06)' },
        },
        'map-pulse': {
          '0%, 100%': { opacity: '0.24', transform: 'scale(0.82)' },
          '50%': { opacity: '0.08', transform: 'scale(1.75)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.7)' },
          '60%': { opacity: '1', transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'shimmer-gold': {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        // A diagonal highlight strip drifting across a wide (250%) gradient.
        // Both endpoints park the strip outside the visible window, so the
        // loop's restart is invisible and no `alternate` direction is needed.
        sheen: {
          from: { backgroundPosition: '0% 0%' },
          to: { backgroundPosition: '100% 0%' },
        },
        // Track is rendered twice, so -50% lands exactly on the seam.
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
        'fade-in': 'fade-in 0.35s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.45s cubic-bezier(0.22,1,0.36,1) forwards',
        'slide-in-left': 'slide-in-left 0.45s cubic-bezier(0.22,1,0.36,1) forwards',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.22,1,0.36,1) forwards',
        float: 'float 4s ease-in-out infinite',
        'float-slow': 'float-slow 6.5s ease-in-out infinite',
        breathe: 'breathe 9s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'map-pulse': 'map-pulse 3.4s ease-in-out infinite',
        'spin-slow': 'spin-slow 28s linear infinite',
        'bounce-in': 'bounce-in 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
        shimmer: 'shimmer 1.5s infinite',
        // `linear`, not an ease: the strip is parked off-window at both
        // endpoints and only crosses the viewport mid-cycle — exactly where an
        // ease-in-out is fastest. Easing turned a 9s drift into a whoosh.
        sheen: 'sheen 9s linear infinite',
        marquee: 'marquee 90s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
