/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './artographer-data-frontend/app/**/*.{js,ts,jsx,tsx}',
    './artographer-data-frontend/pages/**/*.{js,ts,jsx,tsx}',
    './artographer-data-frontend/components/**/*.{js,ts,jsx,tsx}',
    './artographer-data-frontend/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
    textColor: {
      DEFAULT: '#1f2937', // Tailwind's gray-800
    },
  },
  plugins: [],
}
