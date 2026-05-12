import markstreamPreset from './tailwind.preset.js'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [markstreamPreset],
  content: ['./src/**/*.{vue,js,ts,jsx,tsx}'],
  important: '.markstream-vue',
  plugins: [],
}
