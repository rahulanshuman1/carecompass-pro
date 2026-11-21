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
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        reveal: { from: { opacity: 0, transform: 'translateY(16px) scale(.98)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(.85)', opacity: 0 }, '60%': { transform: 'scale(1.04)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        ping2: { '0%': { transform: 'scale(1)', opacity: 0.55 }, '80%,100%': { transform: 'scale(2.1)', opacity: 0 } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        grow: { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        slideUp: { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
      },
      animation: {
        rise: 'rise .25s ease-out both',
        reveal: 'reveal .55s cubic-bezier(.2,.8,.2,1) both',
        pop: 'pop .45s cubic-bezier(.2,.8,.2,1) both',
        ping2: 'ping2 1.8s cubic-bezier(0,0,.2,1) infinite',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        grow: 'grow .7s cubic-bezier(.2,.8,.2,1) both',
        slideUp: 'slideUp .3s cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
};
