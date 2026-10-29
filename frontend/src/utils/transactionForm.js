// Form <-> API mapping and validation for the add/edit transaction dialog.
import { toISODate } from './dates'
import { validateAmount } from './validators'

export const TITLE_MAX = 120
export const DESCRIPTION_MAX = 5000

export const toFormValues = (txn) => ({
  type: txn?.type ?? 'expense',
  category_id: txn?.category.id ?? '',
  title: txn?.title ?? '',
  amount: txn?.amount ?? '',
  transaction_date: txn?.transaction_date ?? toISODate(),
  payment_method: txn?.payment_method ?? '',
  description: txn?.description ?? '',
})

export function validateTransaction(v) {
  return {
    title: !v.title.trim()
      ? 'Title is required'
      : v.title.trim().length > TITLE_MAX
        ? `Keep it under ${TITLE_MAX} characters`
        : null,
    amount: validateAmount(v.amount),
    category_id: v.category_id ? null : 'Choose a category',
    transaction_date: v.transaction_date ? null : 'Date is required',
    description:
      v.description.length > DESCRIPTION_MAX ? `Keep it under ${DESCRIPTION_MAX} characters` : null,
  }
}

/** API payload for POST/PUT (PUT replaces the whole transaction, so every field is sent). */
export const toPayload = (v) => ({
  type: v.type,
  category_id: v.category_id,
  title: v.title.trim(),
  amount: String(v.amount),
  transaction_date: v.transaction_date,
  payment_method: v.payment_method || null,
  description: v.description.trim() || null,
})
