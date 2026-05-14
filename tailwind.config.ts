import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
    "./utils/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "secondary-fixed-dim": "#ffb961",
        "inverse-surface": "#2d3131",
        "on-primary-fixed-variant": "#37485b",
        "on-tertiary-container": "#51aef3",
        "surface-bright": "#f7faf9",
        "primary-fixed-dim": "#b6c8df",
        "surface-tint": "#4f6073",
        "on-secondary-fixed-variant": "#663e00",
        background: "#f7faf9",
        outline: "#74777d",
        "on-tertiary-fixed": "#001d31",
        error: "#ba1a1a",
        "surface-variant": "#e0e3e2",
        "surface-container-high": "#e6e9e8",
        "secondary-container": "#fea520",
        "on-primary": "#ffffff",
        "on-secondary-container": "#694000",
        "on-primary-fixed": "#0a1d2d",
        "surface-container-low": "#f1f4f3",
        "outline-variant": "#c4c6cd",
        "on-background": "#181c1c",
        "surface-container": "#ebeeed",
        "secondary-fixed": "#ffddb9",
        "inverse-primary": "#b6c8df",
        "tertiary-fixed": "#cce5ff",
        "tertiary-container": "#004064",
        "on-surface": "#181c1c",
        "on-secondary": "#ffffff",
        "surface-dim": "#d7dbda",
        "error-container": "#ffdad6",
        "primary-fixed": "#d2e4fb",
        "primary-container": "#2d3e50",
        "on-tertiary-fixed-variant": "#004b73",
        "on-error": "#ffffff",
        "inverse-on-surface": "#eef1f0",
        primary: "#172839",
        "on-secondary-fixed": "#2b1700",
        "surface-container-highest": "#e0e3e2",
        "on-surface-variant": "#43474c",
        "tertiary-fixed-dim": "#92ccff",
        secondary: "#865300",
        "surface-container-lowest": "#ffffff",
        "on-tertiary": "#ffffff",
        tertiary: "#002942",
        "on-primary-container": "#97a9be",
        surface: "#f7faf9",
        "on-error-container": "#93000a"
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      spacing: {
        "touch-target-min": "48px",
        gutter: "1.5rem",
        "stack-sm": "0.5rem",
        "margin-edge": "2rem",
        "stack-lg": "2rem",
        "stack-md": "1rem"
      },
      fontFamily: {
        "title-sm": ["Inter", "sans-serif"],
        "data-mono": ["JetBrains Mono", "monospace"],
        "label-caps": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "display-lg": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"]
      },
      fontSize: {
        "title-sm": [
          "18px",
          {
            lineHeight: "24px",
            fontWeight: "600"
          }
        ],
        "data-mono": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "500"
          }
        ],
        "label-caps": [
          "12px",
          {
            lineHeight: "16px",
            letterSpacing: "0.05em",
            fontWeight: "700"
          }
        ],
        "headline-md": [
          "24px",
          {
            lineHeight: "32px",
            fontWeight: "600"
          }
        ],
        "body-md": [
          "16px",
          {
            lineHeight: "24px",
            fontWeight: "400"
          }
        ],
        "display-lg": [
          "32px",
          {
            lineHeight: "40px",
            letterSpacing: "-0.02em",
            fontWeight: "700"
          }
        ],
        "body-sm": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "400"
          }
        ]
      },
      boxShadow: {
        soft: "0 2px 4px rgba(23, 40, 57, 0.1)",
        panel: "0 8px 30px rgba(0, 0, 0, 0.12)"
      }
    }
  },
  plugins: []
}

export default config
