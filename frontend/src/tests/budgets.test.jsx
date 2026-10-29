import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import BudgetForm from '@/components/budgets/BudgetForm'
import BudgetProgress from '@/components/budgets/BudgetProgress'
import OverallBudgetCard from '@/components/budgets/OverallBudgetCard'

const budget = (over = {}) => ({
  id: 'b1',
  category: null,
  monthly_limit: '1000.00',
  spent: '300.00',
  remaining: '700.00',
  percent_used: 30,
  alert_threshold: 80,
  status: 'on_track',
  ...over,
})

const summary = (over = {}) => ({
  currency: 'USD',
  overall: budget(),
  days_in_month: 31,
  days_elapsed: 10,
  days_left: 22,
  daily_allowance: '31.82',
  projected_spend: '930.00',
  ...over,
})

// ---------- progress ----------

test('progress bar caps at 100% and reports the real percentage', () => {
  render(<BudgetProgress budget={budget({ percent_used: 140, status: 'exceeded' })} />)
  const bar = screen.getByRole('progressbar')
  expect(bar).toHaveAttribute('aria-valuenow', '140')
  expect(bar.firstChild).toHaveStyle({ width: '100%' })
  expect(bar.firstChild).toHaveClass('bg-rose-500')
})

// ---------- overall card ----------

test('shows limit, current spending, remaining and daily allowance', () => {
  render(<OverallBudgetCard summary={summary()} onEdit={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByText('left to spend')).toBeInTheDocument()
  const stat = (label) => screen.getByText(label).nextSibling.textContent
  expect(stat('Budget limit')).toBe('$1,000.00')
  expect(stat('Current spending')).toBe('$300.00')
  expect(stat('Remaining')).toBe('$700.00')
  expect(stat('Per day · 22 days left')).toBe('$31.82')
  expect(screen.getByText('On track')).toBeInTheDocument()
})

test('over budget shows the overrun', () => {
  render(
    <OverallBudgetCard
      summary={summary({
        overall: budget({
          spent: '1200.00',
          remaining: '-200.00',
          percent_used: 120,
          status: 'exceeded',
        }),
      })}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText('over budget')).toBeInTheDocument()
  expect(screen.getByText('Over budget')).toBeInTheDocument()
  expect(screen.getByText('Remaining').nextSibling).toHaveClass('text-rose-600')
})

test('warns when the spending pace will exceed the budget', () => {
  render(
    <OverallBudgetCard
      summary={summary({ projected_spend: '1250.00' })}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText(/At this pace you’ll spend about \$1,250\.00/)).toHaveTextContent(
    '$250.00 over your budget',
  )
})

// ---------- form ----------

function renderForm(props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue()
  render(
    <BudgetForm
      kind="overall"
      month="2026-10"
      categories={[{ id: 'groc', name: 'Groceries' }]}
      currency="USD"
      lastMonth={{ total: 2450.5, byCategory: { groc: 410 } }}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  const field = (label) => screen.getByLabelText(label, { selector: 'input, select' })
  return { onSubmit, field }
}

test('overall budget: validates, hints last month, submits payload', async () => {
  const { onSubmit, field } = renderForm()
  expect(screen.getByText('Last month you spent $2,450.50.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save budget' }))
  expect(screen.getByText('Amount is required')).toBeInTheDocument()

  fireEvent.change(field('Monthly limit'), { target: { value: '2500' } })
  fireEvent.change(field('Warn me when spending reaches'), { target: { value: '90' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save budget' }))
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({
      category_id: null,
      monthly_limit: '2500',
      alert_threshold: 90,
    }),
  )
})

test('category budget: requires a category and hints that category’s spend', async () => {
  const { onSubmit, field } = renderForm({ kind: 'category' })
  fireEvent.change(field('Monthly limit'), { target: { value: '400' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save budget' }))
  expect(screen.getByText('Choose a category')).toBeInTheDocument()
  fireEvent.change(field('Category'), { target: { value: 'groc' } })
  expect(screen.getByText('Last month you spent $410.00 here.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save budget' }))
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({
      category_id: 'groc',
      monthly_limit: '400',
      alert_threshold: 80,
    }),
  )
})

test('duplicate budget (409) is shown on the field', async () => {
  const onSubmit = vi
    .fn()
    .mockRejectedValue({ response: { status: 409, data: { error: { message: 'exists' } } } })
  const { field } = renderForm({ kind: 'category', onSubmit })
  fireEvent.change(field('Category'), { target: { value: 'groc' } })
  fireEvent.change(field('Monthly limit'), { target: { value: '400' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save budget' }))
  expect(await screen.findByText('A budget for this already exists this month')).toBeInTheDocument()
})

test('editing pre-fills and hides the category picker', () => {
  const { field } = renderForm({
    kind: 'category',
    budget: budget({
      category: { id: 'groc', name: 'Groceries' },
      monthly_limit: '400.00',
      alert_threshold: 90,
    }),
  })
  expect(screen.getByRole('heading', { name: 'Edit Groceries budget' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Category', { selector: 'select' })).not.toBeInTheDocument()
  expect(field('Monthly limit').value).toBe('400.00')
  expect(field('Warn me when spending reaches').value).toBe('90')
})
