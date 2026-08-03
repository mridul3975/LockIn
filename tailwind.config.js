/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#050811',
        foreground: '#f8fafc',
        card: {
          DEFAULT: 'rgba(10, 15, 30, 0.7)',
          foreground: '#f8fafc',
        },
        border: 'rgba(255, 255, 255, 0.08)',
        cyber: {
          neon: '#10B981', // Neon emerald green
          blue: '#3B82F6',
          violet: '#8B5CF6',
          rose: '#F43F5E',
          glow: 'rgba(16, 185, 129, 0.15)',
        }
      },
      backgroundImage: {
        'cyber-gradient': 'linear-gradient(to bottom right, #050811, #0a0f20, #060a17)',
        'glow-gradient': 'radial-gradient(circle at top, rgba(16, 185, 129, 0.12), transparent)',
      },
      boxShadow: {
        'neon-glow': '0 0 15px rgba(16, 185, 129, 0.3)',
        'neon-border': 'inset 0 0 8px rgba(16, 185, 129, 0.2), 0 0 12px rgba(16, 185, 129, 0.1)',
      }
    },
  },
  plugins: [],
}
