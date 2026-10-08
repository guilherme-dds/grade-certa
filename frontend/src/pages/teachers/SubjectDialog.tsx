import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/Button'

interface SubjectDialogProps {
  availableSubjects: string[]
  onAddSubject: (subjectName: string) => void
  onClose: () => void
}

export function SubjectDialog({ availableSubjects, onAddSubject, onClose }: SubjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [error, setError] = useState('')

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = newSubjectName.trim()
    if (!trimmed) {
      setError('Informe o nome da disciplina.')
      return
    }
    const exists = availableSubjects.some((s) => s.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      setError('Esta disciplina já está cadastrada.')
      return
    }

    onAddSubject(trimmed)
    close()
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      aria-labelledby="subject-dialog-title"
      className="m-auto w-[min(420px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h3 id="subject-dialog-title" className="text-[17px] font-semibold">
          Nova Disciplina
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          Cadastre uma nova disciplina para disponibilizar no cadastro dos professores.
        </p>

        <div className="mt-4">
          <FormField
            label="Nome da disciplina"
            placeholder="Ex.: Filosofia, Química, Sociologia..."
            value={newSubjectName}
            onChange={(e) => {
              setNewSubjectName(e.target.value)
              if (error) setError('')
            }}
            error={error}
            autoFocus
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit">Cadastrar disciplina</Button>
        </div>
      </form>
    </dialog>
  )
}
