import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'

export default function BulkActionBar({ count, onClear, onDelete }) {
  if (!count) return null
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white"
    >
      <span>
        <strong className="font-semibold">{count}</strong> selected
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2 py-1 text-gray-300 hover:text-white"
        >
          Clear
        </button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Icon name="trash" className="h-4 w-4" />
          Delete selected
        </Button>
      </div>
    </div>
  )
}
