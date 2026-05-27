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
        // AOE surface layers
        'aoe-base':    '#09090b', // zinc-950 — deepest application canvas
        'aoe-surface': '#18181b', // zinc-900 — card and panel layer
        'aoe-border':  '#27272a', // zinc-800 — structural dividers
        // AOE accent states
        'aoe-active':  '#10b981', // emerald-500 — IN STOCK, confirmations, active CTA
        'aoe-warn':    '#fbbf24', // amber-400  — Pending status, low-stock warnings
        'aoe-danger':  '#ef4444', // red-500    — OUT OF STOCK, error states
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
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
