/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--text-rgb) / <alpha-value>)",
        forest: "rgb(var(--accent-rgb) / <alpha-value>)",
        mint: "rgb(var(--mint-rgb) / <alpha-value>)",
        paper: "rgb(var(--surface-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
        amber: {
          DEFAULT: "rgb(var(--warning-rgb) / <alpha-value>)",
          50: "var(--warning-soft)",
          100: "var(--warning-border)",
          200: "var(--warning-border-strong)",
          600: "var(--warning)",
          700: "var(--warning-strong)",
          800: "var(--warning-strong)",
          900: "var(--warning-text)",
          950: "var(--warning-text)",
        },
        slate: {
          100: "var(--slate-100)",
          200: "var(--slate-200)",
          300: "var(--text-faint)",
          400: "var(--text-muted)",
          500: "var(--text-muted)",
          600: "var(--text-secondary)",
        },
        rose: {
          50: "var(--danger-soft)",
          100: "var(--danger-border)",
          500: "var(--danger)",
          600: "var(--danger)",
          700: "var(--danger-strong)",
        },
        sky: { 50: "var(--info-soft)", 500: "var(--info)", 700: "var(--info-strong)" },
        teal: { 500: "var(--teal)" },
      },
      boxShadow: {
        card: "0 22px 70px rgba(0, 0, 0, 0.18)",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Noto Sans Kannada", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
