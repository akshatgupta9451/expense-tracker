import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: colors.indigo,
        income: colors.green[600],
        expense: colors.red[600],
      },
    },
  },
  plugins: [],
}
