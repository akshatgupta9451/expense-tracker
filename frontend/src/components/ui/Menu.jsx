import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/utils/cn'

/**
 * Dropdown menu: `trigger({ open, toggle, props })` renders the button; `children(close)` the
 * items (use <MenuItem>). Closes on outside click, Escape and item selection; arrow keys move
 * between items.
 */
export function Menu({ trigger, children, align = 'right', className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        ref.current?.querySelector('[aria-haspopup]')?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = [...ref.current.querySelectorAll('[role="menuitem"]:not([disabled])')]
        const i = items.indexOf(document.activeElement)
        const next =
          e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
        items[next]?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => setOpen((o) => !o)
  const close = () => setOpen(false)

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      {trigger({
        open,
        toggle,
        props: {
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          'aria-controls': menuId,
          onClick: toggle,
        },
      })}
      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-40 mt-2 w-72 origin-top rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-gray-200',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ className, ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700',
        'hover:bg-gray-50 focus:bg-gray-50 focus:outline-none disabled:cursor-wait disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}
