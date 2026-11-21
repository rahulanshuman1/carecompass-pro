/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#fff1f5', 100: '#ffe0e9', 200: '#ffc2d4', 300: '#ff94b3', 400: '#f9628e', 500: '#ec3a71', 600: '#d42459', 700: '#b01a49', 800: '#8f1a40', 900: '#771a3a' },
        ink: { 50: '#f6f3fa', 100: '#ebe5f3', 200: '#d6cbe6', 500: '#6b5a85', 700: '#3b2a55', 800: '#2b1d42', 900: '#1d1330' },
        sun: { 50: '#fff9eb', 100: '#ffefc6', 400: '#fbbf24', 500: '#f59e0b' },
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { soft: '0 1px 2px rgb(43 29 66 / 0.04), 0 8px 24px -8px rgb(43 29 66 / 0.10)', lift: '0 12px 32px -12px rgb(212 36 89 / 0.35)' },
      keyframes: { rise: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } } },
      animation: { rise: 'rise .25s ease-out both' },
    },
  },
  plugins: [],
};
