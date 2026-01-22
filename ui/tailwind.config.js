// /ui/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    screens: {
      sm: '576px', // Small devices / phones
      md: '768px', // Medium devices / tablets
      lg: '992px', // Large devices / small desktops
      xl: '1400px', // Extra large desktops
      '2xl': '1600px' // Ultra-wide / high-res monitors
    },
    extend: {}
  },
  plugins: []
};
