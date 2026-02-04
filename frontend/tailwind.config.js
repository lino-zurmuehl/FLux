/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Merlot - using rose as base, customized darker
        primary: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#be123c', // deep wine red
          600: '#9f1239',
          700: '#881337',
          800: '#6b1029',
          900: '#4c0d1c',
          950: '#2d0711',
        },
      },
    },
  },
  plugins: [],
};
