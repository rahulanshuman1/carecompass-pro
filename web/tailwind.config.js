/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#effaf8', 100: '#d6f3ee', 200: '#ade6dd', 300: '#78d3c8', 400: '#43b9ae', 500: '#2a9d94', 600: '#1f7f7a', 700: '#1d6662', 800: '#1c5250', 900: '#1b4443' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { soft: '0 1px 2px rgb(16 24 40 / 0.04), 0 4px 16px -4px rgb(16 24 40 / 0.06)' },
      keyframes: { rise: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } } },
      animation: { rise: 'rise .25s ease-out both' },
    },
  },
  plugins: [],
};
