import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))", input: "hsl(var(--input))", ring: "hsl(var(--ring))", background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        sidebar: { DEFAULT: "hsl(var(--sidebar-background))", foreground: "hsl(var(--sidebar-foreground))", primary: "hsl(var(--sidebar-primary))", "primary-foreground": "hsl(var(--sidebar-primary-foreground))", accent: "hsl(var(--sidebar-accent))", "accent-foreground": "hsl(var(--sidebar-accent-foreground))", border: "hsl(var(--sidebar-border))", ring: "hsl(var(--sidebar-ring))" },
        // ISF Tracker approved brand palette: Yellow #F3E308, Light Gray #B8BFC1, Muted Blue #6C8494, Deep Blue #2C4C5C
        blue: { 600: "#2C4C5C" },
        cyan: { 500: "#6C8494" },
        teal: { 300: "#6C8494", 600: "#2C4C5C" },
        purple: { 200: "#DCE1E3", 300: "#6C8494", 400: "#6C8494", 600: "#2C4C5C" },
        coral: { 300: "#F3E308", 400: "#F3E308", 500: "#7A6600" },
        pink: { 500: "#6C8494" },
        yellow: { 400: "#F3E308", 600: "#7A6600" },
        slate: { 50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0", 300: "#B8BFC1", 400: "#94A3B8", 500: "#64748B", 600: "#475569", 700: "#334155", 800: "#1E293B", 900: "#172033" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      keyframes: { "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } }, "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } } },
      animation: { "accordion-down": "accordion-down 0.2s ease-out", "accordion-up": "accordion-up 0.2s ease-in" },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
