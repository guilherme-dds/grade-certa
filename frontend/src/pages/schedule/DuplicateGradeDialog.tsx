import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { GradeBackend } from '@/api/grades'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/Button'
import { getApiErrorMessage } from '@/lib/apiError'

interface DuplicateGradeDialogProps {
  grade: GradeBackend
  onClose: () => void
  /** Cria a cópia com o nome escolhido e passa a exibi-la */
  onConfirm: (nome: string) => Promise<void>
}

export function DuplicateGradeDialog({ grade, onClose, onConfirm }: DuplicateGradeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [nome, setNome] = useState(`${grade.nome} (cópia)`)
  const [isSaving, setIsSaving] = useState(false)
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setIsSaving(true)
      setError(null)
      await onConfirm(nome.trim())
      close()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível duplicar a grade. Tente novamente.'))
    } finally {
      setIsSaving(false)
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
      aria-labelledby="duplicate-grade-dialog-title"
      className="m-auto w-[min(440px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h3 id="duplicate-grade-dialog-title" className="text-[17px] font-semibold">
          Duplicar grade
        </h3>
        <p className="mt-2 text-[13px] text-muted">
          A cópia leva as {grade.total_aulas} aulas, os planejamentos e as janelas, e passa a ser a grade exibida. Edite
          a cópia e a original fica como está.
        </p>

        <div className="mt-4">
          <FormField label="Nome da cópia" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>

        {error && <p className="mt-3 text-xs text-danger">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving || !nome.trim()}>
            {isSaving ? 'Duplicando...' : 'Duplicar'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
