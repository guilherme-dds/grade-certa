import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Lesson } from '@/schedule/ScheduleContext'
import { useSchedule } from '@/schedule/useSchedule'
import { LessonEditDialog } from './LessonEditDialog'
import { ScheduleGrid } from './ScheduleGrid'

export function SchedulePage() {
  const { role } = useAuth()
  const { lessons, activeGrade, horariosTurmas, isLoading, refreshSchedule } = useSchedule()
  const [params, setParams] = useSearchParams()

  const gradeIdParam = params.get('gradeId')

  useEffect(() => {
    if (gradeIdParam) {
      refreshSchedule(Number(gradeIdParam))
    }
  }, [gradeIdParam, refreshSchedule])

  const availableTurmas = useMemo(() => {
    const fromLessons = Array.from(new Set(lessons.map((l) => l.classGroup))).filter(Boolean).sort()
    return fromLessons
  }, [lessons])

  const availableTeachers = useMemo(
    () => Array.from(new Set(lessons.flatMap((l) => l.teachers.map((t) => t.nome)))).sort(),
    [lessons],
  )

  const availableRooms = useMemo(
    () => Array.from(new Set(lessons.map((l) => l.room).filter((r): r is string => Boolean(r)))).sort(),
    [lessons],
  )

  const classGroup = availableTurmas.find((c) => c === params.get('turma')) ?? availableTurmas[0] ?? ''
  const teacher = params.get('professor') ?? ''
  const room = params.get('sala') ?? ''
  const canEdit = role === 'coordenacao'
  const editing = canEdit ? lessons.find((l) => String(l.id) === params.get('aula')) : undefined

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const isDimmed = (l: Lesson) =>
    (teacher !== '' && !l.teachers.some((t) => t.nome === teacher)) || (room !== '' && l.room !== room)

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
        <p className="mt-3 text-sm text-muted">Carregando horários da grade...</p>
      </div>
    )
  }

  if (lessons.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Grade Horária"
          description="Visualização dos horários semanais distribuídos por turma e professor."
          actions={
            canEdit && (
              <Link to="/geracao" className={buttonStyles()}>
                Gerar Grade Automática
              </Link>
            )
          }
        />
        <div className="rounded-xl border border-dashed border-line bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-ink">Nenhuma grade horária encontrada</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Ainda não há horários gerados salvos no sistema. Acesse o gerador inteligente para montar a distribuição
            semanal de aulas automaticamente com Google OR-Tools.
          </p>
          {canEdit && (
            <div className="mt-6">
              <Link to="/geracao" className={buttonStyles()}>
                Ir para Geração Automática →
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  const turmaLessons = lessons.filter((l) => l.classGroup === classGroup)
  const turmaSlots = turmaLessons.length ? horariosTurmas[turmaLessons[0].turmaId] : undefined
  const planejamentos = (activeGrade?.detalhes?.planejamentos ?? []).filter((p) => p.professor === teacher)

  return (
    <>
      <PageHeader
        title={`Grade — ${classGroup}`}
        description={
          activeGrade
            ? [
                activeGrade.nome,
                activeGrade.ano_semestre && `Semestre ${activeGrade.ano_semestre}`,
                `${lessons.length} aulas alocadas no total`,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        actions={
          <>
            <FilterChip
              label="Turma"
              value={classGroup}
              options={availableTurmas}
              onChange={(v) => setParam('turma', v)}
            />
            <FilterChip
              label="Professor"
              value={teacher}
              options={availableTeachers}
              allLabel="Todos"
              onChange={(v) => setParam('professor', v)}
            />
            <FilterChip
              label="Sala"
              value={room}
              options={availableRooms}
              allLabel="Todas"
              onChange={(v) => setParam('sala', v)}
            />
            {canEdit && (
              <Link to="/geracao" className={buttonStyles({ variant: 'secondary' })}>
                Nova Geração
              </Link>
            )}
          </>
        }
      />

      <ScheduleGrid
        lessons={turmaLessons}
        timeSlots={turmaSlots}
        editingId={editing?.id}
        isDimmed={isDimmed}
        onSelect={canEdit ? (lesson) => setParam('aula', String(lesson.id)) : undefined}
      />

      {teacher && planejamentos.length > 0 && (
        <p className="mt-3.5 text-[12.5px]">
          <span className="font-semibold">Planejamento de {teacher}:</span>{' '}
          {planejamentos
            .map((p) => `${p.dia_semana} ${p.horario}${p.compartilhado ? ' (compartilhado)' : ''}`)
            .join(' · ')}
        </p>
      )}

      <p className="mt-3.5 text-[12.5px] text-muted">
        {canEdit
          ? 'Clique em uma célula para reatribuir professor, sala ou horário. Célula em destaque: edição em andamento.'
          : 'Visualização somente leitura. Alterações na grade são feitas pela coordenação.'}
      </p>

      {editing && <LessonEditDialog key={editing.id} lesson={editing} onClose={() => setParam('aula', null)} />}
    </>
  )
}

interface FilterChipProps {
  label: string
  value: string
  options: readonly string[]
  allLabel?: string
  onChange: (value: string) => void
}

function FilterChip({ label, value, options, allLabel, onChange }: FilterChipProps) {
  return (
    <label className="flex items-center gap-1 rounded-md border border-line bg-white py-1 pr-1 pl-3 text-[12.5px] focus-within:border-primary">
      <span className="text-muted">{label}:</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-40 cursor-pointer bg-transparent py-1 pr-1 font-medium outline-none"
      >
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
