
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: { 
    extend: {
      fontFamily: {
        sans: ['"Century Gothic"', 'Poppins', 'Apple Gothic', 'Avant Garde', 'sans-serif'],
      },} 
    },
  plugins: [],
}
