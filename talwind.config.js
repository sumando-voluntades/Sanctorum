/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        primary: "#8a5100",
        "primary-container": "#f39200",
        secondary: "#b50062",
        "secondary-container": "#e2007c",
        surface: "#f6fafe",
        "surface-container-low": "#f0f4f8",
        "surface-container-lowest": "#ffffff",
        "on-surface": "#171c1f",
        "on-surface-variant": "#544434"
      },
      fontFamily: {
        sans: ["Quicksand", "sans-serif"],
        plus: ["Plus Jakarta Sans", "sans-serif"]
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}