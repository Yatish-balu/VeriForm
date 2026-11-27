/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F7F5',
        sidebar: '#F1F0EC',
        'sidebar-active': '#E2E7DC',
        'sidebar-card': '#E9E6DC',
        'preview-bg': '#EFECE5',
        'action-card': '#ECEAE2',
        forest: {
          DEFAULT: '#293F2D',
          hover: '#203324',
          soft: '#EAF2E8',
        },
        ink: '#111827',
        slateink: '#64748B',
        borderline: '#E5E7EB',
        success: '#166534',
        warning: '#92400E',
        danger: '#991B1B',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
