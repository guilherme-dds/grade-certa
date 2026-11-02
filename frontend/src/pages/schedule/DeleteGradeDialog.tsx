import { useEffect, useRef, useState } from 'react'
import type { GradeBackend } from '@/api/grades'
import { Button } from '@/components/ui/Button'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime } from '@/lib/schedule'

interface DeleteGradeDialogProps {
  grade: GradeBackend
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function DeleteGradeDialog({ grade, onClose, onConfirm }: DeleteGradeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError(null)
      await onConfirm()
      close()
    } catch (err) {
      console.error(err)
      setError(getApiErrorMessage(err, 'Não foi possível excluir a grade. Tente novamente.'))
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
      aria-labelledby="delete-grade-dialog-title"
      className="m-auto w-[min(440px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <div className="p-6">
        <h3 id="delete-grade-dialog-title" className="text-[17px] font-semibold text-danger">
          Excluir Grade
        </h3>
        <p className="mt-2 text-[14px] text-ink">
          Tem certeza que deseja excluir a grade <strong className="font-semibold">{grade.nome}</strong>, gerada em{' '}
          {formatDateTime(grade.criado_em)}, com {grade.total_aulas} aulas?
        </p>
        <p className="mt-1 text-[12.5px] text-muted">
          As edições manuais feitas nela também serão perdidas. Esta ação não poderá ser desfeita.
        </p>

        {error && <p className="mt-3 text-xs text-danger">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-danger text-white hover:bg-danger/90"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir grade'}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
