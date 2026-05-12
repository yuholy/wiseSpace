/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: [
      './app/**/*.{js,ts,jsx,tsx,mdx}',
      './pages/**/*.{js,ts,jsx,tsx,mdx}',
      './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
