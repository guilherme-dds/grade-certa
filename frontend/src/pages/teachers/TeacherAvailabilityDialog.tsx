import { useEffect, useRef } from 'react'
import type { ProfessorBackend } from '@/api/professores'
import { ProfessorAvailabilityEditor } from '@/components/ProfessorAvailabilityEditor'
import { Button } from '@/components/ui/Button'

interface TeacherAvailabilityDialogProps {
  professor: ProfessorBackend
  onClose: () => void
}

export function TeacherAvailabilityDialog({ professor, onClose }: TeacherAvailabilityDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }
  }, [])

  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      aria-labelledby="availability-dialog-title"
      className="m-auto w-[min(740px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <div className="max-h-[90vh] overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="availability-dialog-title" className="text-[17px] font-semibold">
              Horários de Disponibilidade — {professor.nome}
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              Todos os horários começam disponíveis. Marque os indisponíveis (o gerador não aloca aulas) e os
              preferenciais (o gerador tenta usar primeiro).
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar"
            className="rounded p-1 text-sm font-semibold text-muted hover:bg-paper hover:text-ink"
          >
            ✕
          </button>
        </div>

        <ProfessorAvailabilityEditor
          professor={professor}
          onSaved={() => setTimeout(close, 400)}
          actions={
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
          }
        />
      </div>
    </dialog>
  )
}
