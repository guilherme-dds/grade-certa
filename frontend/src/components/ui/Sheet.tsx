import { createContext, use, useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { DISCARD_CHANGES, useConfirm, useUnsavedChangesGuard } from './ConfirmDialog'
import { Icon } from './Icon'

/* Botões "Cancelar" dentro do painel passam pela mesma confirmação do Esc */
const SheetCloseContext = createContext<() => void>(() => {})
// eslint-disable-next-line react-refresh/only-export-components
export const useSheetClose = () => use(SheetCloseContext)

const widths = {
  md: 'w-[min(560px,calc(100%-1rem))]',
  lg: 'w-[min(760px,calc(100%-1rem))]',
  xl: 'w-[min(960px,calc(100%-1rem))]',
}

interface SheetProps {
  title: ReactNode
  description?: ReactNode
  /** Resumo à direita do título (ex.: total de aulas) */
  aside?: ReactNode
  width?: keyof typeof widths
  /** Com alterações não salvas, fechar pelo Esc ou clicando fora pede confirmação */
  dirty?: boolean
  onClose: () => void
  /** Use SheetBody e SheetFooter; podem vir dentro de um <form className="contents"> */
  children: ReactNode
}

/**
 * Painel lateral de altura total para edições com muito conteúdo.
 * Cabeçalho e rodapé ficam fixos; só o corpo rola.
 */
export function Sheet({ title, description, aside, width = 'lg', dirty = false, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const confirm = useConfirm()
  // Voltar no navegador com o painel aberto e alterado também pede confirmação
  const allowLeave = useUnsavedChangesGuard(dirty)

  const close = () => {
    ref.current?.close()
    onClose()
  }
  const requestClose = async () => {
    if (dirty && !(await confirm(DISCARD_CHANGES))) return
    allowLeave()
    close()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        requestClose()
      }}
      onClick={(e) => e.target === e.currentTarget && requestClose()}
      className={cn(
        'sheet fixed top-2 right-2 bottom-2 left-auto m-0 flex h-auto max-h-none max-w-none flex-col overflow-hidden bg-white p-0 text-ink',
        'open:animate-[sheet-in_220ms_cubic-bezier(0.2,0.8,0.2,1)] [&:not([open])]:hidden',
        widths[width],
      )}
    >
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 border-b border-line-soft px-6 pt-5 pb-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="col-start-1 row-start-1 min-w-0">
          <h2 id={titleId} className="font-display text-[20px] leading-tight font-bold">
            {title}
          </h2>
          {description && <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-muted">{description}</p>}
        </div>
        {aside && <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">{aside}</div>}
        <button
          type="button"
          onClick={requestClose}
          aria-label="Fechar"
          className="col-start-2 row-start-1 -mt-1 -mr-2 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink sm:col-start-3"
        >
          <Icon name="close" className="size-[18px]" />
        </button>
      </header>
      <SheetCloseContext value={requestClose}>{children}</SheetCloseContext>
    </dialog>
  )
}

export function SheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', className)}>{children}</div>
}

/** Rodapé fixo: à esquerda, status ou resumo; à direita, os botões. */
export function SheetFooter({ start, children }: { start?: ReactNode; children: ReactNode }) {
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-white px-6 py-4">
      <div className="min-w-0 text-[13px] text-muted">{start}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </footer>
  )
}
