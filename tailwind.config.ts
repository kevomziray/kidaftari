import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effbf6",
          100: "#d9f5e8",
          500: "#159a64",
          600: "#0d7c50",
          700: "#096340",
        },
      },
      boxShadow: {
        card: "0 2px 12px rgba(16, 24, 40, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
