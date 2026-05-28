/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── WhatsApp Dark Mode palette ──────────────────────────────────────────
        'wa-bg-main':        '#0b141a', // Application root canvas
        'wa-bg-header':      '#202c33', // App bar / navigation surface
        'wa-bg-chat':        '#111b21', // Chat list row background
        'wa-teal':           '#00a884', // Primary brand accent — badges, toggles, CTAs
        'wa-blue-check':     '#53bdeb', // Read-receipt double-check colour
        'wa-text-primary':   '#e9edef', // High-contrast foreground text
        'wa-text-secondary': '#8696a0', // Muted labels, timestamps, metadata
        'wa-border':         '#222c32', // Hair-line row dividers
      },
      fontFamily: {
        // Native system sans-serif stack — no external font dependency
        sans: [
          'Segoe UI',
          'Roboto',
          '-apple-system',
          'BlinkMacSystemFont',
          'San Francisco',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
}
