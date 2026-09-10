import platformPreset from '@grace/platform-core/tailwind-preset';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [platformPreset],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/platform-core/src/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [],
};
