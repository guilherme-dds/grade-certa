/* eslint-disable react-refresh/only-export-components */
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

type Notify = (message: string) => void

const ToastContext = createContext<Notify>(() => {})

/** Mostra uma confirmação curta no rodapé (ex.: "Professor cadastrado") que some sozinha. */
export const useToast = () => use(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const notify = useCallback<Notify>((message) => {
    window.clearTimeout(timer.current)
    setToast({ id: Date.now(), message })
    timer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Popover na camada do topo: aparece por cima de painéis e diálogos abertos (que também ficam lá).
  // Reabrir a cada mensagem o coloca acima do que foi aberto depois.
  const layerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const layer = layerRef.current
    if (!layer?.showPopover) return
    if (layer.matches(':popover-open')) layer.hidePopover()
    if (!toast) return
    // Espera o quadro seguinte: um painel aberto junto com a mensagem (ex.: a matriz da turma nova) entra antes
    const frame = requestAnimationFrame(() => layer.showPopover())
    return () => cancelAnimationFrame(frame)
  }, [toast])

  return (
    <ToastContext value={notify}>
      {children}
      {/* Fica sempre no DOM para o leitor de tela anunciar cada mensagem nova */}
      <div
        ref={layerRef}
        popover="manual"
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-auto bottom-5 m-0 flex w-full justify-center overflow-visible border-0 bg-transparent px-4 print:hidden"
      >
        {toast && (
          <p
            key={toast.id}
            className="flex animate-[confirm-in_180ms_cubic-bezier(0.2,0.8,0.2,1)] items-center gap-2 rounded-full bg-ink py-2.5 pr-5 pl-3 text-[14px] font-medium text-white shadow-(--shadow-float)"
          >
            <span className="grid size-6 place-items-center rounded-full bg-accent text-ink">
              <Icon name="check" width={14} height={14} />
            </span>
            {toast.message}
          </p>
        )}
      </div>
    </ToastContext>
  )
}
