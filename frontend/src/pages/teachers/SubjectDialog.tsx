import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/Button'
import { getApiErrorMessage } from '@/lib/apiError'

interface SubjectDialogProps {
  availableSubjects: string[]
  /** Nome atual, ao renomear; sem ele o diálogo cadastra uma disciplina nova */
  currentName?: string
  /** O que muda ao renomear (ex.: turmas cujas matrizes recebem o novo nome) */
  renameHint?: ReactNode
  onSave: (subjectName: string) => Promise<unknown> | void
  onClose: () => void
}

/** Sem acento e sem caixa, como o backend compara */
const chave = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

export function SubjectDialog({ availableSubjects, currentName, renameHint, onSave, onClose }: SubjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [newSubjectName, setNewSubjectName] = useState(currentName ?? '')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const renaming = currentName != null

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = newSubjectName.trim()
    if (!trimmed) {
      setError('Informe o nome da disciplina.')
      return
    }
    if (renaming && trimmed === currentName) {
      close()
      return
    }
    const existente = availableSubjects.find(
      (s) => chave(s) === chave(trimmed) && !(renaming && chave(s) === chave(currentName)),
    )
    if (existente) {
      setError(`Já existe uma disciplina chamada ${existente}.`)
      return
    }

    setIsSaving(true)
    try {
      await onSave(trimmed)
      close()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível salvar a disciplina.'))
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
      aria-labelledby="subject-dialog-title"
      className="m-auto w-[min(420px,calc(100%-2rem))] card p-0 text-ink"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h3 id="subject-dialog-title" className="text-[17px] font-semibold">
          {renaming ? 'Renomear disciplina' : 'Nova disciplina'}
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          {renaming
            ? (renameHint ?? 'O novo nome aparece no cadastro dos professores.')
            : 'Cadastre uma nova disciplina para disponibilizar no cadastro dos professores.'}
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
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando…' : renaming ? 'Salvar nome' : 'Cadastrar disciplina'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
