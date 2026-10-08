import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { TurmaBackend } from '@/api/turmas'

interface DeleteTurmaDialogProps {
  turma: TurmaBackend
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function DeleteTurmaDialog({ turma, onClose, onConfirm }: DeleteTurmaDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await onConfirm()
      close()
    } catch (err) {
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      aria-labelledby="delete-turma-dialog-title"
      className="m-auto w-[min(420px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <div className="p-6">
        <h3 id="delete-turma-dialog-title" className="text-[17px] font-semibold text-danger">
          Excluir Turma
        </h3>
        <p className="mt-2 text-[14px] text-ink">
          Tem certeza que deseja excluir a turma <strong className="font-semibold">{turma.nome}</strong> ({turma.turno})?
        </p>
        <p className="mt-1 text-[12.5px] text-muted">Esta ação não poderá ser desfeita.</p>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-danger hover:bg-danger/90 text-white"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir turma'}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
