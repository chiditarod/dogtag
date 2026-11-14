/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        flag: '#b3ddf2',
        star: '#e4002b',
        starText: '#c4001f',
        navy: '#12202f',
        link: '#2f5aae',
        page: '#f4f8fb',
      },
      fontFamily: {
        display: ['Oswald', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
