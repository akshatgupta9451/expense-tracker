import Button from '@/components/ui/Button'
import { PAGE_SIZES } from '@/hooks/useTransactionQuery'

export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, total)

  return (
    <nav
      className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Pagination"
    >
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>
          Showing <span className="font-medium text-gray-900">{from}</span>–
          <span className="font-medium text-gray-900">{to}</span> of{' '}
          <span className="font-medium text-gray-900">{total}</span>
        </span>
        <label className="flex items-center gap-1.5">
          <span className="sr-only sm:not-sr-only">Rows</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border-0 py-1 pl-2 pr-7 text-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-500"
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="px-1 text-sm text-gray-500">
            Page {page} of {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </nav>
  )
}
