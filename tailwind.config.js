/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        surface: '#1e293b',
        surfaceHighlight: '#334155',
        fofoOrange: '#f97316',
        fofoAmber: '#fbbf24',
        primary: '#8b5cf6',
      },
    },
  },
  plugins: [],
};
