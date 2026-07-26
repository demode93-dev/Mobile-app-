import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lockhart brand palette - asphalt charcoal + traffic-paint yellow.
        lockhart: {
          asphalt: "#1c1917",
          charcoal: "#2a2624",
          yellow: "#f5b400",
          amber: "#d97706",
        },
      },
    },
  },
  plugins: [],
};

export default config;
