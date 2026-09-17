/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bel: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#0052cc',
          600: '#0747a6',
          700: '#172b4d',
          800: '#091e42',
          900: '#051429',
        },
      },
    },
  },
  plugins: [],
};
