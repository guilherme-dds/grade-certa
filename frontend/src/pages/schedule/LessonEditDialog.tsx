import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { simularEdicao, type SimulacaoEdicao } from '@/api/grades'
import { getProfessores } from '@/api/professores'
import { getSalas } from '@/api/salas'
import { MultiSelectChips } from '@/components/MultiSelectChips'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/Button'
import { getApiErrorMessage } from '@/lib/apiError'
import { weekDays } from '@/lib/schedule'
import type { Lesson } from '@/schedule/ScheduleContext'
import { useSchedule } from '@/schedule/useSchedule'

const SEM_VALOR = ''

interface LessonEditDialogProps {
  lesson: Lesson
  onClose: () => void
}

export function LessonEditDialog({ lesson, onClose }: LessonEditDialogProps) {
  const { updateLesson, horariosTurmas } = useSchedule()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const professoresQuery = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() })
  const salasQuery = useQuery({ queryKey: ['salas'], queryFn: getSalas })

  const [values, setValues] = useState({
    teacherIds: lesson.teachers.flatMap((t) => (t.id != null ? [String(t.id)] : [])),
    room: lesson.room ?? SEM_VALOR,
    day: lesson.day,
    time: lesson.time,
  })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // Resultado da simulação dos valores atuais; com conflitos novos, o próximo "Salvar" confirma
  const [simulacao, setSimulacao] = useState<SimulacaoEdicao | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // Fecha explicitamente em vez de depender do evento nativo "close" do <dialog>
  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setError(null)
    setSimulacao(null)
  }

  const professorOptions = (professoresQuery.data ?? [])
    .filter((p) => p.ativo || lesson.teachers.some((t) => t.id === p.id))
    .map((p) => ({ value: String(p.id), label: p.nome }))
  const salaOptions = [
    { value: SEM_VALOR, label: 'Sem sala' },
    ...(salasQuery.data ?? []).map((s) => ({ value: s.nome, label: s.nome })),
  ]
  const horarios = horariosTurmas[lesson.turmaId] ?? [lesson.time]

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const changes = {
      day: values.day,
      time: values.time,
      teacherIds: values.teacherIds.map(Number),
      room: values.room || null,
    }
    try {
      setIsSaving(true)
      // Primeiro "Salvar": confere os conflitos que a edição criaria e, havendo algum, pede confirmação
      if (!simulacao) {
        const resultado = await simularEdicao(lesson.id, {
          dia_semana: changes.day,
          horario: changes.time,
          professor_ids: changes.teacherIds,
          sala_nome: changes.room,
        })
        if (resultado.novos.length > 0) {
          setSimulacao(resultado)
          return
        }
      }
      const result = await updateLesson(lesson.id, changes)
      if (result.ok) close()
      else setError(result.error)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível conferir a edição.'))
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
      aria-labelledby="lesson-edit-title"
      className="m-auto w-[min(420px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h2 id="lesson-edit-title" className="text-[17px] font-semibold">
          Editar aula — {lesson.subject} · {lesson.classGroup}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Atualmente em {lesson.day}, {lesson.time}. Antes de salvar, os conflitos que a mudança criaria são mostrados aqui.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Professores</p>
            <MultiSelectChips
              options={professorOptions}
              value={values.teacherIds}
              onChange={(ids) => set('teacherIds', ids)}
              addLabel={values.teacherIds.length ? '+ professor (aula em conjunto)' : 'Escolher professor'}
              emptyLabel="Sem professor"
            />
          </div>
          <SelectField label="Sala" options={salaOptions} value={values.room} onChange={(e) => set('room', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Dia" options={weekDays} value={values.day} onChange={(e) => set('day', e.target.value)} />
            <SelectField label="Horário" options={horarios} value={values.time} onChange={(e) => set('time', e.target.value)} />
          </div>
        </div>

        {simulacao && (
          <div role="alert" className="mt-4 rounded-md border border-warning/40 bg-warning-soft p-3 text-[13px]">
            <p className="font-semibold text-warning">
              Esta mudança cria {simulacao.novos.length} conflito{simulacao.novos.length > 1 ? 's' : ''}:
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              {simulacao.novos.map((c) => (
                <li key={c.id}>
                  <span className="font-medium">{c.tipo}:</span> {c.descricao}
                </li>
              ))}
            </ul>
            {simulacao.resolvidos.length > 0 && (
              <p className="mt-1.5 text-muted">E resolve {simulacao.resolvidos.length} conflito(s) atual(is).</p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 text-[13px] text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando...' : simulacao ? 'Salvar mesmo assim' : 'Salvar'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
