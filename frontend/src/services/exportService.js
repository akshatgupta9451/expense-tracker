import api from './apiClient'

export const EXPORT_FORMATS = [
  { value: 'pdf', label: 'PDF report', hint: 'Summary, categories and all rows', icon: 'document' },
  {
    value: 'xlsx',
    label: 'Excel (.xlsx)',
    hint: 'Spreadsheet with a summary sheet',
    icon: 'table',
  },
  { value: 'csv', label: 'CSV', hint: 'Plain data for any tool', icon: 'list' },
]

const clean = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))

/** `attachment; filename="transactions_….csv"` -> `transactions_….csv` */
export function filenameFromHeader(header, fallback) {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header ?? '')
  return match ? decodeURIComponent(match[1]) : fallback
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const exportService = {
  /**
   * Download transactions matching `filters` (same params as the list) as csv / xlsx / pdf.
   * Returns the filename that was saved.
   */
  async download(format, filters = {}) {
    try {
      const res = await api.get('/exports/transactions', {
        params: clean({ ...filters, format, page: undefined, page_size: undefined }),
        responseType: 'blob',
      })
      const filename = filenameFromHeader(
        res.headers['content-disposition'],
        `transactions.${format}`,
      )
      saveBlob(res.data, filename)
      return filename
    } catch (err) {
      // With responseType "blob", error bodies arrive as a Blob too; turn JSON errors back into
      // objects so the usual error helpers can read them.
      const data = err.response?.data
      if (data instanceof Blob && data.type.includes('json')) {
        try {
          err.response.data = JSON.parse(await data.text())
        } catch {
          /* keep the original */
        }
      }
      throw err
    }
  },
}
