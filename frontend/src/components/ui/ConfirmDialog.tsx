/* eslint-disable react-refresh/only-export-components */
import { createContext, use, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useBlocker } from 'react-router'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  /** Texto do botão que confirma (ex.: "Descartar") */
  confirmLabel: string
  /** Texto do botão que volta atrás (padrão: "Cancelar") */
  cancelLabel?: string
  /** "danger" deixa o botão de confirmar vermelho, para ações que perdem dados */
  tone?: 'default' | 'danger'
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm>(async () => false)

/** Pede confirmação com um diálogo da própria interface; resolve true se a pessoa confirmar. */
export const useConfirm = () => use(ConfirmContext)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setRequest({ ...options, resolve })
      }),
    [],
  )

  return (
    <ConfirmContext value={confirm}>
      {children}
      {request && (
        <ConfirmModal
          {...request}
          onDone={(ok) => {
            request.resolve(ok)
            setRequest(null)
          }}
        />
      )}
    </ConfirmContext>
  )
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'default',
  onDone,
}: ConfirmOptions & { onDone: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const finish = (ok: boolean) => {
    ref.current?.close()
    onDone(ok)
  }

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        finish(false)
      }}
      onClick={(e) => e.target === e.currentTarget && finish(false)}
      className="m-auto w-[min(420px,calc(100%-2rem))] animate-[confirm-in_180ms_cubic-bezier(0.2,0.8,0.2,1)] bg-white p-0 text-ink"
    >
      <div className="p-6">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-10 place-items-center rounded-full font-display text-[18px] font-bold',
            tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-paper text-ink',
          )}
        >
          !
        </span>
        <h2 id={titleId} className="mt-4 font-display text-[19px] leading-tight font-bold">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-1.5 text-[14px] leading-relaxed text-muted">
            {description}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {/* O foco começa em "voltar": Enter por engano não descarta nada */}
          <Button type="button" variant="secondary" autoFocus onClick={() => finish(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => finish(true)}
            className={cn(tone === 'danger' && 'bg-danger text-white hover:bg-danger/90')}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

/** Textos padrão para alterações não salvas */
export const DISCARD_CHANGES: ConfirmOptions = {
  title: 'Descartar alterações?',
  description: 'O que você mudou aqui ainda não foi salvo e será perdido.',
  confirmLabel: 'Descartar',
  cancelLabel: 'Continuar editando',
  tone: 'danger',
}

/**
 * Com alterações não salvas, sair da tela (menu, links, voltar do navegador) pede confirmação
 * pelo diálogo da interface. Trocar só os parâmetros da URL (ex.: fechar um painel) não conta.
 * Retorna `allowLeave`, para liberar a saída depois de uma confirmação feita por outro caminho.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const confirm = useConfirm()
  const allowed = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allowed.current && currentLocation.pathname !== nextLocation.pathname,
  )

  // O objeto do blocker muda a cada render; o efeito reage só à mudança de estado
  const blockerRef = useRef(blocker)
  useEffect(() => {
    blockerRef.current = blocker
  })

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    let active = true
    confirm(DISCARD_CHANGES).then((ok) => {
      if (!active) return
      if (ok) {
        allowed.current = true
        blockerRef.current.proceed?.()
      } else {
        blockerRef.current.reset?.()
      }
    })
    return () => {
      active = false
    }
  }, [blocker.state, confirm])

  return useCallback(() => {
    allowed.current = true
  }, [])
}
