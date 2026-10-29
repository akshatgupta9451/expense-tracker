import { useState } from 'react'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import { Menu, MenuItem } from '@/components/ui/Menu'
import Spinner from '@/components/ui/Spinner'
import { useToast } from '@/hooks/useToast'
import { EXPORT_FORMATS, exportService } from '@/services/exportService'
import { getErrorMessage } from '@/utils/errors'

/**
 * "Export" button + format menu. `filters` are the same params as the transactions list, so the
 * file contains exactly what the user is looking at. `description` explains the scope.
 */
export default function ExportMenu({ filters, description, disabled, label = 'Export' }) {
  const { notify } = useToast()
  const [busy, setBusy] = useState(null) // format being generated

  const run = async (format, close) => {
    setBusy(format)
    try {
      const filename = await exportService.download(format, filters)
      notify(`Downloaded ${filename}`)
      close()
    } catch (err) {
      notify(getErrorMessage(err, 'Export failed. Please try again.'), { type: 'error' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Menu
      trigger={({ props }) => (
        <Button variant="secondary" disabled={disabled} {...props}>
          <Icon name="download" className="h-4 w-4" />
          {label}
          <Icon name="chevronDown" className="h-4 w-4 text-gray-400" />
        </Button>
      )}
    >
      {(close) => (
        <>
          {description && <p className="px-3 pb-2 pt-1.5 text-xs text-gray-500">{description}</p>}
          {EXPORT_FORMATS.map((f) => (
            <MenuItem key={f.value} onClick={() => run(f.value, close)} disabled={Boolean(busy)}>
              <span className="mt-0.5 text-gray-400">
                {busy === f.value ? (
                  <Spinner decorative className="h-4 w-4" />
                ) : (
                  <Icon name={f.icon} className="h-4 w-4" />
                )}
              </span>
              <span>
                <span className="block font-medium text-gray-900">
                  {busy === f.value ? 'Preparing…' : f.label}
                </span>
                <span className="block text-xs text-gray-500">{f.hint}</span>
              </span>
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  )
}
