import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FormField } from '@/components/FormField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/Button'
import { type Teacher } from '@/mocks/teachers'

interface TeacherDialogProps {
  teacher?: Teacher | null
  availableSubjects: string[]
  onAddSubject: (subjectName: string) => void
  onClose: () => void
  onSave: (teacherData: Omit<Teacher, 'id' | 'currentWeeklyHours'> & { id?: string }) => void
}

export function TeacherDialog({
  teacher,
  availableSubjects,
  onAddSubject,
  onClose,
  onSave,
}: TeacherDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const isEditing = Boolean(teacher)

  const [name, setName] = useState(teacher?.name ?? '')
  const [email, setEmail] = useState(teacher?.email ?? '')
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(teacher?.maxWeeklyHours ?? 20)
  const [status, setStatus] = useState<'ativo' | 'inativo'>(teacher?.status ?? 'ativo')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(teacher?.subjects ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Estado para criação inline de disciplina
  const [isAddingSubject, setIsAddingSubject] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectError, setNewSubjectError] = useState('')

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

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    )
    if (errors.subjects) {
      setErrors((prev) => ({ ...prev, subjects: '' }))
    }
  }

  const handleCreateSubject = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = newSubjectName.trim()
    if (!trimmed) {
      setNewSubjectError('Digite o nome da disciplina.')
      return
    }

    const exists = availableSubjects.some(
      (s) => s.toLowerCase() === trimmed.toLowerCase(),
    )
    if (exists) {
      setNewSubjectError('Esta disciplina já existe.')
      return
    }

    onAddSubject(trimmed)
    if (!selectedSubjects.includes(trimmed)) {
      setSelectedSubjects((prev) => [...prev, trimmed])
    }
    setNewSubjectName('')
    setNewSubjectError('')
    setIsAddingSubject(false)
    if (errors.subjects) {
      setErrors((prev) => ({ ...prev, subjects: '' }))
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório.'
    }
    if (!email.trim() || !email.includes('@')) {
      newErrors.email = 'Informe um e-mail válido.'
    }
    if (selectedSubjects.length === 0) {
      newErrors.subjects = 'Selecione pelo menos uma disciplina.'
    }
    if (maxWeeklyHours < 1 || maxWeeklyHours > 60) {
      newErrors.maxWeeklyHours = 'Carga horária deve ser entre 1h e 60h.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onSave({
      id: teacher?.id,
      name: name.trim(),
      email: email.trim(),
      subjects: selectedSubjects,
      maxWeeklyHours: Number(maxWeeklyHours),
      status,
    })

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
      aria-labelledby="teacher-dialog-title"
      className="m-auto w-[min(520px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h2 id="teacher-dialog-title" className="text-[17px] font-semibold">
          {isEditing ? 'Editar Professor' : 'Novo Professor'}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          {isEditing
            ? 'Atualize as informações e carga horária do docente.'
            : 'Cadastre um novo docente para alocação na grade.'}
        </p>

        <div className="mt-5 space-y-4">
          <FormField
            label="Nome completo"
            placeholder="Ex.: Ana Ferreira"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
            }}
            error={errors.name}
          />

          <FormField
            label="E-mail institucional"
            type="email"
            placeholder="nome@escola.gov.br"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
            }}
            error={errors.email}
          />

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-medium text-muted">
                Disciplinas ministradas
              </label>
              {!isAddingSubject && (
                <button
                  type="button"
                  onClick={() => setIsAddingSubject(true)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  + Criar nova disciplina
                </button>
              )}
            </div>

            {/* Campo Inline para criar disciplina */}
            {isAddingSubject && (
              <div className="mb-3 rounded-md border border-primary-soft-line bg-primary-soft/40 p-2.5">
                <p className="mb-1.5 text-xs font-semibold text-primary">Nova disciplina</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome da disciplina (ex: Filosofia)"
                    value={newSubjectName}
                    onChange={(e) => {
                      setNewSubjectName(e.target.value)
                      if (newSubjectError) setNewSubjectError('')
                    }}
                    className="flex-1 rounded border border-line bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                    autoFocus
                  />
                  <Button type="button" size="sm" onClick={handleCreateSubject}>
                    Adicionar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsAddingSubject(false)
                      setNewSubjectName('')
                      setNewSubjectError('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
                {newSubjectError && (
                  <p className="mt-1 text-xs text-danger">{newSubjectError}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 rounded-md border border-line p-3">
              {availableSubjects.map((subject) => {
                const isSelected = selectedSubjects.includes(subject)
                return (
                  <button
                    type="button"
                    key={subject}
                    onClick={() => toggleSubject(subject)}
                    className={
                      isSelected
                        ? 'rounded border border-primary-soft-line bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary transition-colors'
                        : 'rounded border border-line-soft bg-paper px-2.5 py-1 text-xs text-muted transition-colors hover:border-line hover:text-ink'
                    }
                  >
                    {isSelected ? `✓ ${subject}` : `+ ${subject}`}
                  </button>
                )
              })}
            </div>
            {errors.subjects && (
              <p className="mt-1 text-xs text-danger">{errors.subjects}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Carga máx. semanal (horas)"
              type="number"
              min={1}
              max={60}
              value={maxWeeklyHours}
              onChange={(e) => {
                setMaxWeeklyHours(Number(e.target.value))
                if (errors.maxWeeklyHours) setErrors((prev) => ({ ...prev, maxWeeklyHours: '' }))
              }}
              error={errors.maxWeeklyHours}
            />

            <SelectField
              label="Status no sistema"
              options={['ativo', 'inativo'] as const}
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ativo' | 'inativo')}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit">{isEditing ? 'Salvar alterações' : 'Cadastrar'}</Button>
        </div>
      </form>
    </dialog>
  )
}
