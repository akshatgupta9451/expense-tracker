import { useCallback, useMemo, useRef, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { cn } from '@/utils/cn'
import { ToastContext } from './ToastContext'

const DURATION_MS = 4000

/** Small non-blocking notifications ("Transaction added"), bottom-right on desktop. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const notify = useCallback(
    (message, { type = 'success' } = {}) => {
      const id = ++nextId.current
      setToasts((t) => [...t.slice(-2), { id, message, type }]) // keep at most 3
      setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
          >
            <Icon
              name={t.type === 'error' ? 'exclamation' : 'checkCircle'}
              className={cn(
                'h-5 w-5 shrink-0',
                t.type === 'error' ? 'text-rose-400' : 'text-emerald-400',
              )}
            />
            <p className="flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-gray-400 hover:text-white"
              aria-label="Dismiss"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
