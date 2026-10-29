import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ExportMenu from '@/components/common/ExportMenu'
import { ToastProvider } from '@/context/ToastProvider'
import api from '@/services/apiClient'
import { exportService, filenameFromHeader } from '@/services/exportService'
import { getErrorMessage } from '@/utils/errors'

test('reads the filename from Content-Disposition', () => {
  expect(
    filenameFromHeader('attachment; filename="transactions_2026-10-01_to_2026-10-31.pdf"', 'x'),
  ).toBe('transactions_2026-10-01_to_2026-10-31.pdf')
  expect(filenameFromHeader(undefined, 'transactions.csv')).toBe('transactions.csv')
})

describe('exportService.download', () => {
  let calls
  beforeEach(() => {
    calls = []
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
  })

  test('sends format + filters (not paging) and saves the file', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    api.defaults.adapter = async (config) => {
      calls.push(config)
      return {
        status: 200,
        data: new Blob(['a,b']),
        headers: { 'content-disposition': 'attachment; filename="transactions_2026-10-27.csv"' },
        config,
      }
    }
    const name = await exportService.download('csv', {
      type: 'expense',
      q: '',
      page: 3,
      page_size: 25,
    })
    expect(name).toBe('transactions_2026-10-27.csv')
    expect(calls[0].params).toEqual({ type: 'expense', format: 'csv' })
    expect(calls[0].responseType).toBe('blob')
    expect(click).toHaveBeenCalledOnce()
  })

  test('turns a JSON error blob back into a readable message', async () => {
    api.defaults.adapter = async (config) => {
      const err = new Error('400')
      err.config = config
      err.response = {
        status: 400,
        config,
        data: new Blob([JSON.stringify({ error: { message: 'Too many transactions' } })], {
          type: 'application/json',
        }),
      }
      throw err
    }
    const err = await exportService.download('pdf').catch((e) => e)
    expect(getErrorMessage(err)).toBe('Too many transactions')
  })
})

describe('ExportMenu', () => {
  const renderMenu = () =>
    render(
      <ToastProvider>
        <ExportMenu filters={{ type: 'income' }} description="Exports 3 transactions." />
      </ToastProvider>,
    )

  test('opens, lists formats, downloads with the given filters', async () => {
    const download = vi.spyOn(exportService, 'download').mockResolvedValue('transactions.pdf')
    renderMenu()
    const button = screen.getByRole('button', { name: /Export/ })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(screen.getByText('Exports 3 transactions.')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      expect.stringContaining('PDF report'),
      expect.stringContaining('Excel (.xlsx)'),
      expect.stringContaining('CSV'),
    ])
    fireEvent.click(screen.getByRole('menuitem', { name: /PDF report/ }))
    await waitFor(() => expect(screen.getByText('Downloaded transactions.pdf')).toBeInTheDocument())
    expect(download).toHaveBeenCalledWith('pdf', { type: 'income' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  test('shows an error toast and keeps the menu open on failure', async () => {
    vi.spyOn(exportService, 'download').mockRejectedValue({
      response: { status: 400, data: { error: { message: 'Narrow the date range' } } },
    })
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /CSV/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Narrow the date range')
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  test('Escape closes the menu and arrow keys move focus', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))
    const items = screen.getAllByRole('menuitem')
    expect(items[0]).toHaveFocus()
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(items[1]).toHaveFocus()
    fireEvent.keyDown(document, { key: 'ArrowUp' })
    fireEvent.keyDown(document, { key: 'ArrowUp' })
    expect(items[2]).toHaveFocus() // wraps around
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
