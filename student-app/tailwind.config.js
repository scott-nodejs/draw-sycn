/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f8ff",
          100: "#e7f1ff",
          200: "#cfe3ff",
          300: "#a8ceff",
          400: "#74adff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8"
        }
      },
      boxShadow: {
        soft: "0 8px 28px rgba(31, 83, 155, 0.08)"
      }
    },
  },
  plugins: [],
}
