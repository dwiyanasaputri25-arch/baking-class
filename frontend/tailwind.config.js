/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#fffaf3',
        rose: '#b95f71',
        cocoa: '#513c32',
        caramel: '#b58358',
        blush: '#f5e1df'
      },
      fontFamily: {
        sans: ['Nunito Sans', 'sans-serif'],
        display: ['DM Serif Display', 'serif']
      },
      boxShadow: {
        card: '0 18px 55px rgba(81, 60, 50, 0.09)'
      }
    }
  },
  plugins: []
};
