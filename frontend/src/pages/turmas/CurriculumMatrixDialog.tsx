import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import type { ItemMatriz, TurmaBackend } from '@/api/turmas'

export interface TeacherWithSubjects {
  name: string
  subjects: string[]
}

interface CurriculumMatrixDialogProps {
  turma: TurmaBackend
  availableSubjects: string[]
  teachers: TeacherWithSubjects[]
  onClose: () => void
  onSave: (matriz: ItemMatriz[]) => Promise<void>
}

export function CurriculumMatrixDialog({
  turma,
  availableSubjects,
  teachers,
  onClose,
  onSave,
}: CurriculumMatrixDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Matriz inicial da turma
  const [items, setItems] = useState<ItemMatriz[]>(() => {
    if (turma.matriz_curricular && turma.matriz_curricular.length > 0) {
      return turma.matriz_curricular.map((m) => ({ ...m }))
    }
    // Caso esteja vazia, oferece sugestões padrão baseadas nos professores disponíveis
    return [
      {
        professor: teachers[0]?.name ?? '',
        disciplina: teachers[0]?.subjects[0] ?? availableSubjects[0] ?? 'Matemática',
        aulas_semanais: 5,
      },
      {
        professor: teachers[1]?.name ?? '',
        disciplina: teachers[1]?.subjects[0] ?? availableSubjects[1] ?? 'Português',
        aulas_semanais: 5,
      },
    ]
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
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

  const handleAddItem = () => {
    const defaultTeacher = teachers[0]?.name ?? ''
    const teacherObj = teachers.find((t) => t.name === defaultTeacher)
    const defaultSubject = teacherObj?.subjects[0] ?? availableSubjects[0] ?? ''

    setItems((prev) => [
      ...prev,
      {
        professor: defaultTeacher,
        disciplina: defaultSubject,
        aulas_semanais: 4,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Atualiza o professor e ajusta dinamicamente a disciplina para as matérias cadastradas do professor
  const handleTeacherChange = (index: number, teacherName: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item

        const teacherObj = teachers.find((t) => t.name === teacherName)
        const allowed = teacherObj?.subjects ?? []

        let newSubject = item.disciplina
        if (allowed.length > 0 && !allowed.includes(item.disciplina)) {
          newSubject = allowed[0]
        }

        return {
          ...item,
          professor: teacherName,
          disciplina: newSubject,
        }
      }),
    )
  }

  const handleSubjectChange = (index: number, subjectName: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        return {
          ...item,
          disciplina: subjectName,
        }
      }),
    )
  }

  const handleHoursChange = (index: number, hours: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        return {
          ...item,
          aulas_semanais: Math.max(1, hours),
        }
      }),
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      setError('Adicione pelo menos uma matéria à matriz curricular.')
      return
    }

    try {
      setIsSubmitting(true)
      await onSave(items)
      close()
    } catch (err) {
      console.error(err)
      setError('Erro ao salvar matriz curricular. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalHours = items.reduce((acc, curr) => acc + (Number(curr.aulas_semanais) || 0), 0)

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      aria-labelledby="matrix-dialog-title"
      className="m-auto w-[min(760px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div>
            <h3 id="matrix-dialog-title" className="text-[18px] font-semibold text-ink">
              Matriz Curricular — {turma.nome}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Turno: <strong className="font-semibold text-ink">{turma.turno}</strong> · Selecione o professor para visualizar apenas as matérias cadastradas em seu perfil.
            </p>
          </div>
          <div className="rounded-md border border-line-soft bg-paper px-3 py-1.5 text-right">
            <p className="text-[11px] font-medium text-muted uppercase tracking-wider">Carga total</p>
            <p className="text-base font-bold font-mono text-primary">
              {totalHours}h <span className="text-xs font-normal text-muted">/ sem</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-danger/30 bg-danger-soft/30 p-3 text-xs text-danger">
            {error}
          </div>
        )}

        {/* Tabela de Matéria e Professor */}
        <div className="mt-4 max-h-[380px] overflow-y-auto pr-1">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-paper/60 text-muted uppercase tracking-wider">
                <th className="py-2.5 px-3 font-semibold">Professor responsável</th>
                <th className="py-2.5 px-3 font-semibold">Matéria / Disciplina</th>
                <th className="py-2.5 px-3 font-semibold w-28">Aulas / sem</th>
                <th className="py-2.5 px-2 text-right w-16">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {items.map((item, idx) => {
                const selectedTeacherObj = teachers.find((t) => t.name === item.professor)
                const teacherRegisteredSubjects = selectedTeacherObj?.subjects ?? []

                // Se o professor selecionado possuir disciplinas no cadastro, exibe APENAS elas.
                // Se nenhum professor estiver selecionado ou o professor não tiver matérias, exibe availableSubjects.
                const allowedSubjects =
                  item.professor && teacherRegisteredSubjects.length > 0
                    ? teacherRegisteredSubjects
                    : availableSubjects

                return (
                  <tr key={idx} className="hover:bg-paper/30 transition-colors">
                    {/* Seleção do Professor */}
                    <td className="py-2 px-3">
                      <select
                        value={item.professor ?? ''}
                        onChange={(e) => handleTeacherChange(idx, e.target.value)}
                        className="w-full rounded border border-line bg-white px-2.5 py-1.5 text-xs text-ink font-medium outline-none focus:border-primary"
                      >
                        <option value="">(Sem professor alocado)</option>
                        {teachers.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Seleção da Matéria (Apenas do cadastro do professor selecionado) */}
                    <td className="py-2 px-3">
                      <select
                        value={item.disciplina}
                        onChange={(e) => handleSubjectChange(idx, e.target.value)}
                        className="w-full rounded border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-primary outline-none focus:border-primary"
                      >
                        {allowedSubjects.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                        {allowedSubjects.length === 0 && (
                          <option value="">Nenhuma matéria cadastrada para este docente</option>
                        )}
                      </select>
                    </td>

                    {/* Quantidade de Aulas Semanais */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={item.aulas_semanais}
                          onChange={(e) => handleHoursChange(idx, Number(e.target.value))}
                          className="w-16 rounded border border-line bg-white px-2 py-1.5 text-center font-mono text-xs text-ink outline-none focus:border-primary"
                        />
                        <span className="text-muted text-[11px]">aulas</span>
                      </div>
                    </td>

                    {/* Ação Remover */}
                    <td className="py-2 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger transition-colors text-xs"
                        title="Remover matéria da matriz"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {items.length === 0 && (
            <div className="py-8 text-center text-xs text-muted border border-dashed border-line rounded-md mt-2">
              Nenhuma matéria cadastrada nesta matriz. Clique no botão abaixo para adicionar.
            </div>
          )}
        </div>

        {/* Botão de Adicionar Nova Matéria */}
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddItem}
            className="w-full border-dashed"
          >
            + Adicionar matéria à matriz
          </Button>
        </div>

        {/* Rodapé com botões de ação */}
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <p className="text-xs text-muted">
            Total: <strong className="text-ink">{items.length}</strong> matérias cadastradas
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={close} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar Matriz Curricular'}
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
