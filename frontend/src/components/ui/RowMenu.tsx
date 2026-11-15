import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export interface RowMenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

/**
 * Ações secundárias de uma linha atrás de um botão "⋯".
 * O menu usa posição fixa para não ser cortado pelo overflow das tabelas.
 */
export function RowMenu({ items, label }: { items: RowMenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const r = buttonRef.current.getBoundingClientRect()
    const menuHeight = items.length * 40 + 12
    const below = r.bottom + 6 + menuHeight < window.innerHeight
    setPos({ top: below ? r.bottom + 6 : r.top - menuHeight - 6, right: window.innerWidth - r.right })
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return
        buttonRef.current?.focus()
      } else if (menuRef.current?.contains(e.target as Node) || buttonRef.current?.contains(e.target as Node)) {
        return
      }
      setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', onScroll, true)
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink',
          open && 'bg-paper text-ink',
        )}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          onKeyDown={onMenuKey}
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-50 min-w-44 rounded-2xl bg-white p-1.5 shadow-[0_16px_40px_-12px_rgb(21_22_26/0.3)] ring-1 ring-line"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={cn(
                'flex h-10 w-full items-center rounded-xl px-3 text-left text-[14px] font-medium outline-none transition-colors',
                item.danger ? 'text-danger hover:bg-danger-soft focus:bg-danger-soft' : 'hover:bg-paper focus:bg-paper',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
