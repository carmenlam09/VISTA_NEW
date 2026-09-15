/** @type {import('tailwindcss').Config} */

// Every token is declared with the `<alpha-value>` placeholder so opacity
// modifiers (bg-brand/10, border-brand/30, ...) resolve against the CSS
// variable instead of being silently dropped.
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        brand: {
          DEFAULT: token("brand"),
          foreground: token("brand-foreground"),
        },
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        success: {
          DEFAULT: token("success"),
          foreground: token("success-foreground"),
        },
        warning: {
          DEFAULT: token("warning"),
          foreground: token("warning-foreground"),
        },
        sidebar: {
          DEFAULT: token("sidebar"),
          raised: token("sidebar-raised"),
          foreground: token("sidebar-foreground"),
          muted: token("sidebar-muted"),
          border: token("sidebar-border"),
        },
        graph: {
          canvas: token("graph-canvas"),
          dot: token("graph-dot"),
          link: token("graph-link"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
