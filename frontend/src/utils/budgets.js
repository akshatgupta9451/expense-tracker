/** Display info for the API's budget `status`. */
export const BUDGET_STATUS = {
  on_track: { label: 'On track', badge: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' },
  warning: { label: 'Near limit', badge: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500' },
  exceeded: { label: 'Over budget', badge: 'bg-rose-50 text-rose-700', bar: 'bg-rose-500' },
}

export const ALERT_THRESHOLDS = [50, 60, 70, 75, 80, 85, 90, 95, 100]
