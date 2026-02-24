import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#0d1117",
        surface: "#161b22",
        surface2:"#21262d",
        border:  "#30363d",
        text:    "#e6edf3",
        muted:   "#8b949e",
        blue:    "#58a6ff",
        green:   "#3fb950",
        red:     "#f85149",
        orange:  "#d29922",
        purple:  "#bc8cff",
        cyan:    "#39d353",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":    "fadeIn 0.3s ease-in-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0", transform: "translateY(4px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
