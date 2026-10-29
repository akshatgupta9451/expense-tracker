// Chart.js registration + the shared look of every dashboard chart.
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { formatCompactCurrency, formatCurrency } from '@/utils/format'

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
)
ChartJS.defaults.font.family = 'Inter, ui-sans-serif, system-ui, sans-serif'
ChartJS.defaults.color = '#6b7280'

export const COLORS = {
  income: '#10b981', // emerald-500
  expense: '#f43f5e', // rose-500
  brand: '#4f46e5', // indigo-600
  brandSoft: '#c7d2fe', // indigo-200
  grid: '#f1f5f9',
}

export function tooltip(currency) {
  return {
    backgroundColor: '#111827',
    titleColor: '#fff',
    bodyColor: '#e5e7eb',
    padding: 10,
    cornerRadius: 8,
    boxPadding: 4,
    usePointStyle: true,
    callbacks: {
      label: (ctx) =>
        ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? ctx.parsed, currency)}`,
    },
  }
}

/** Shared x/y axes for bar and line charts. */
export function axes(currency) {
  return {
    x: { grid: { display: false }, border: { display: false } },
    y: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: COLORS.grid },
      ticks: { maxTicksLimit: 5, callback: (v) => formatCompactCurrency(v, currency) },
    },
  }
}
