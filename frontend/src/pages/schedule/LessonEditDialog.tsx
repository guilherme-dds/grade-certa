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
  // Simulação feita para uma combinação de valores (a chave); só vale enquanto os valores forem os mesmos
  const [previa, setPrevia] = useState<{ chave: string; resultado: SimulacaoEdicao } | null>(null)
  const [erroPrevia, setErroPrevia] = useState<string | null>(null)

  const payload = {
    dia_semana: values.day,
    horario: values.time,
    professor_ids: values.teacherIds.map(Number),
    sala_nome: values.room || null,
  }
  const chave = JSON.stringify(payload)
  const [chaveOriginal] = useState(chave)
  const alterado = chave !== chaveOriginal
  const simulacao = previa?.chave === chave ? previa.resultado : null
  const conferindo = alterado && !simulacao && !erroPrevia

  // Confere os conflitos assim que a pessoa muda algo (com uma pequena espera entre mudanças seguidas)
  useEffect(() => {
    if (!alterado) return
    let ativo = true
    const timer = window.setTimeout(() => {
      simularEdicao(lesson.id, JSON.parse(chave))
        .then((resultado) => ativo && setPrevia({ chave, resultado }))
        .catch((err) => ativo && setErroPrevia(getApiErrorMessage(err, 'Não foi possível conferir os conflitos.')))
    }, 300)
    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [chave, alterado, lesson.id])

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
    setErroPrevia(null)
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
    if (!alterado) {
      close()
      return
    }
    try {
      setIsSaving(true)
      // Se a conferência ainda não voltou, faz agora; havendo conflito novo, mostra antes de gravar
      if (!simulacao) {
        const resultado = await simularEdicao(lesson.id, payload)
        setPrevia({ chave, resultado })
        if (resultado.novos.length > 0) return
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
      className="m-auto w-[min(420px,calc(100%-2rem))] card p-0 text-ink"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h2 id="lesson-edit-title" className="text-[17px] font-semibold">
          Editar aula — {lesson.subject} · {lesson.classGroup}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Atualmente em {lesson.day}, {lesson.time}. Ao mudar algo, os conflitos que a mudança criaria aparecem aqui
          antes de salvar.
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
          <SelectField label="Sala" options={salaOptions} value={values.room} onChange={(v) => set('room', v)} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Dia" options={weekDays} value={values.day} onChange={(v) => set('day', v)} />
            <SelectField label="Horário" options={horarios} value={values.time} onChange={(v) => set('time', v)} />
          </div>
        </div>

        {alterado && (conferindo || erroPrevia || simulacao?.novos.length === 0) && (
          <p
            role="status"
            className={
              erroPrevia
                ? 'mt-4 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger'
                : simulacao
                  ? 'mt-4 rounded-xl bg-primary-soft px-3 py-2.5 text-[13px] font-medium text-primary'
                  : 'mt-4 rounded-xl bg-paper px-3 py-2.5 text-[13px] text-muted'
            }
          >
            {erroPrevia ??
              (simulacao
                ? `Sem conflitos novos.${simulacao.resolvidos.length ? ` E resolve ${simulacao.resolvidos.length} ${simulacao.resolvidos.length > 1 ? 'conflitos atuais' : 'conflito atual'}.` : ''}`
                : 'Conferindo conflitos…')}
          </p>
        )}

        {simulacao && simulacao.novos.length > 0 && (
          <div role="alert" className="mt-4 rounded-xl border border-warning/40 bg-warning-soft p-3 text-[13px]">
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
              <p className="mt-1.5 text-muted">
                E resolve {simulacao.resolvidos.length}{' '}
                {simulacao.resolvidos.length > 1 ? 'conflitos atuais' : 'conflito atual'}.
              </p>
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
          {/* Mudança que o backend recusa (ex.: horário já ocupado pela turma) não tem como salvar */}
          <Button type="submit" disabled={isSaving || Boolean(erroPrevia)}>
            {isSaving ? 'Salvando...' : simulacao?.novos.length ? 'Salvar mesmo assim' : 'Salvar'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
