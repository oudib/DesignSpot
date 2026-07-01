import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd3ff",
          300: "#8eb6ff",
          400: "#598dff",
          500: "#3464f6",
          600: "#1f47eb",
          700: "#1837d8",
          800: "#1a30af",
          900: "#1b2f8a",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 20px rgba(15, 23, 42, 0.05)",
        "card-hover":
          "0 2px 8px rgba(15, 23, 42, 0.06), 0 20px 50px rgba(15, 23, 42, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
