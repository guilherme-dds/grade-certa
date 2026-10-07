import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { type Teacher } from '@/mocks/teachers'

interface DeleteTeacherDialogProps {
  teacher: Teacher
  onClose: () => void
  onConfirm: () => void
}

export function DeleteTeacherDialog({ teacher, onClose, onConfirm }: DeleteTeacherDialogProps) {
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
      aria-labelledby="delete-teacher-dialog-title"
      className="m-auto w-[min(400px,calc(100%-2rem))] rounded-lg border border-line bg-white p-6 text-ink shadow-lg backdrop:bg-black/40"
    >
      <h3 id="delete-teacher-dialog-title" className="text-base font-semibold">
        Excluir Professor
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Tem certeza que deseja remover <strong>{teacher.name}</strong>? Esta ação não pode ser desfeita na memória local.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={close}>
          Cancelar
        </Button>
        <Button
          className="bg-danger hover:bg-danger/90 text-white"
          onClick={() => {
            onConfirm()
            close()
          }}
        >
          Excluir
        </Button>
      </div>
    </dialog>
  )
}
