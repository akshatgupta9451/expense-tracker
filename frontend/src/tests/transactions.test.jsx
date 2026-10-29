import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import TransactionForm from '@/components/transactions/TransactionForm'
import { useTransactionQuery } from '@/hooks/useTransactionQuery'
import { toPayload, validateTransaction } from '@/utils/transactionForm'

const CATEGORIES = [
  { id: 'food', name: 'Food', type: 'expense', is_archived: false },
  { id: 'old', name: 'Old stuff', type: 'expense', is_archived: true },
  { id: 'salary', name: 'Salary', type: 'income', is_archived: false },
]

// ---------- form model ----------

test('validation covers required fields and limits', () => {
  const errors = validateTransaction({
    title: '  ',
    amount: '0',
    category_id: '',
    transaction_date: '',
    description: 'x'.repeat(5001),
  })
  expect(errors).toEqual({
    title: 'Title is required',
    amount: 'Amount must be greater than 0',
    category_id: 'Choose a category',
    transaction_date: 'Date is required',
    description: 'Keep it under 5000 characters',
  })
})

test('payload trims text and sends nulls for empty optional fields', () => {
  expect(
    toPayload({
      type: 'expense',
      category_id: 'food',
      title: '  Lunch ',
      amount: 12.5,
      transaction_date: '2026-10-01',
      payment_method: '',
      description: '   ',
    }),
  ).toEqual({
    type: 'expense',
    category_id: 'food',
    title: 'Lunch',
    amount: '12.5',
    transaction_date: '2026-10-01',
    payment_method: null,
    description: null,
  })
})

// ---------- URL-synced query ----------

function renderQuery(url) {
  let location
  const Spy = () => {
    location = useLocation()
    return null
  }
  const wrapper = ({ children }) => (
    <MemoryRouter initialEntries={[url]}>
      {children}
      <Spy />
    </MemoryRouter>
  )
  const hook = renderHook(() => useTransactionQuery(), { wrapper })
  return { ...hook, location: () => location }
}

test('reads filters, sort and page from the URL', () => {
  const { result } = renderQuery(
    '/transactions?type=income&sort=-amount&page=3&page_size=25&q=rent',
  )
  expect(result.current.filters.type).toBe('income')
  expect(result.current.filters.q).toBe('rent')
  expect(result.current.sort).toBe('-amount')
  expect(result.current.page).toBe(3)
  expect(result.current.pageSize).toBe(25)
  expect(result.current.activeFilterCount).toBe(2)
})

test('ignores junk values in the URL', () => {
  const { result } = renderQuery('/transactions?sort=drop_table&page=-4&page_size=9999')
  expect(result.current.sort).toBe('-transaction_date')
  expect(result.current.page).toBe(1)
  expect(result.current.pageSize).toBe(10)
})

test('changing a filter resets to page 1; defaults are left out of the URL', () => {
  const { result, location } = renderQuery('/transactions?page=4')
  act(() => result.current.update({ type: 'expense' }))
  expect(location().search).toBe('?type=expense')
  act(() => result.current.update({ page: 2 }))
  expect(location().search).toBe('?type=expense&page=2')
  act(() => result.current.update({ sort: '-transaction_date' })) // the default
  expect(location().search).toBe('?type=expense')
  act(() => result.current.clearFilters())
  expect(location().search).toBe('')
})

test('invalid ranges are flagged and not sent to the API', () => {
  const { result } = renderQuery(
    '/transactions?min_amount=100&max_amount=5&start_date=2026-10-31&end_date=2026-10-01',
  )
  expect(result.current.invalid).toEqual({ amount: true, dates: true })
  expect(result.current.apiQuery).toMatchObject({
    min_amount: '',
    max_amount: '',
    start_date: '',
    end_date: '',
  })
})

// ---------- dialog ----------

function renderForm(props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue()
  render(
    <TransactionForm
      categories={CATEGORIES}
      currency="EUR"
      onClose={vi.fn()}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  const field = (label) => screen.getByLabelText(label, { selector: 'input, select, textarea' })
  const type = (label, value) => fireEvent.change(field(label), { target: { value } })
  return { onSubmit, field, type }
}

test('category options follow the selected type, archived ones hidden', () => {
  const { field } = renderForm()
  const options = () => [...field('Category').options].map((o) => o.textContent)
  expect(options()).toEqual(['Select a category…', 'Food'])
  fireEvent.click(screen.getByRole('radio', { name: 'Income' }))
  expect(options()).toEqual(['Select a category…', 'Salary'])
})

test('switching type clears a category of the other type', () => {
  const { field, type } = renderForm()
  type('Category', 'food')
  fireEvent.click(screen.getByRole('radio', { name: 'Income' }))
  expect(field('Category').value).toBe('')
})

test('shows the currency symbol and a description counter', () => {
  const { type } = renderForm()
  expect(screen.getByText('€')).toBeInTheDocument()
  type('Description', 'hello')
  expect(screen.getByText('Optional · 5/5000')).toBeInTheDocument()
})

test('does not submit an invalid form', () => {
  const { onSubmit } = renderForm()
  fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }))
  expect(screen.getByText('Title is required')).toBeInTheDocument()
  expect(screen.getByText('Choose a category')).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})

test('"Save & add another" keeps type, category and date and clears the rest', async () => {
  const { onSubmit, field, type } = renderForm()
  type('Title', 'Coffee')
  type('Amount', '3.20')
  type('Category', 'food')
  type('Date', '2026-10-05')
  fireEvent.click(screen.getByRole('button', { name: 'Save & add another' }))

  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  expect(onSubmit.mock.calls[0][1]).toEqual({ addAnother: true })
  await waitFor(() => expect(field('Title').value).toBe(''))
  expect(field('Amount').value).toBe('')
  expect(field('Category').value).toBe('food')
  expect(field('Date').value).toBe('2026-10-05')
  // A fresh form: no "required" errors on the now-empty fields.
  expect(screen.queryByText('Title is required')).not.toBeInTheDocument()
  expect(field('Title')).toHaveFocus()
})

test('editing pre-fills every field and keeps an archived category', () => {
  const { field } = renderForm({
    transaction: {
      id: 't1',
      type: 'expense',
      category: { id: 'old' },
      title: 'Old lamp',
      amount: '40.00',
      currency: 'USD',
      transaction_date: '2026-09-01',
      payment_method: 'card',
      description: 'Garage sale',
    },
  })
  expect(field('Title').value).toBe('Old lamp')
  expect(field('Amount').value).toBe('40.00')
  expect(field('Category').value).toBe('old')
  expect(field('Payment method').value).toBe('card')
  expect(field('Description').value).toBe('Garage sale')
  expect(screen.getByText('$')).toBeInTheDocument() // the transaction's own currency
  expect(screen.queryByRole('button', { name: 'Save & add another' })).not.toBeInTheDocument()
})
