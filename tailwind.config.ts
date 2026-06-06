import type { Config } from 'tailwindcss'

export default {
  content: ['./src/client/src/**/*.{ts,tsx}', './src/client/index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dde6ff',
          500: '#4f6ef7',
          600: '#3b57e8',
          700: '#2e45cc',
          900: '#1a2a7a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        'office-bob': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        'status-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'office-bob': 'office-bob 3s ease-in-out infinite',
        'status-pulse': 'status-pulse 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config
