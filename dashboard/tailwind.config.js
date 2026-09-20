/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        console: {
          bg: "#0F1115",
          panel: "#171A21",
          border: "#2A2F3A",
          text: "#E7E9EE",
          muted: "#8B92A3",
        },
        alert: {
          DEFAULT: "#E23D28",
          dim: "#7A2318",
        },
        calm: {
          DEFAULT: "#2DD4A6",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
