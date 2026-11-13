import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteGrade, duplicarGrade, getHistoricoGrades } from '@/api/grades'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Icon } from '@/components/ui/Icon'
import { paths } from '@/config/paths'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/schedule'
import type { Lesson } from '@/schedule/ScheduleContext'
import { useSchedule } from '@/schedule/useSchedule'
import { DeleteGradeDialog } from './DeleteGradeDialog'
import { DuplicateGradeDialog } from './DuplicateGradeDialog'
import { LessonEditDialog } from './LessonEditDialog'
import { ScheduleGrid } from './ScheduleGrid'

export function SchedulePage() {
  const { lessons, activeGrade, horariosTurmas, isLoading, refreshSchedule, changes, undoLastChange } = useSchedule()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)
  // Resultado do último "desfazer"; some quando o histórico muda (nova edição ou outra grade)
  const [undoResult, setUndoResult] = useState<{ ok: boolean; text: string; changesLeft: number } | null>(null)
  const undoMessage = undoResult?.changesLeft === changes.length ? undoResult : null

  const handleUndo = async () => {
    const desfeita = changes[0]
    setIsUndoing(true)
    const result = await undoLastChange()
    setIsUndoing(false)
    setUndoResult(
      result.ok
        ? { ok: true, text: `Desfeito: ${desfeita.descricao}`, changesLeft: changes.length - 1 }
        : { ok: false, text: result.error, changesLeft: changes.length },
    )
  }

  // Grades geradas com sucesso, para trocar a grade exibida
  const { data: historico = [] } = useQuery({ queryKey: ['historicoGrades'], queryFn: getHistoricoGrades })
  const gradesGeradas = historico.filter((g) => g.status === 'sucesso')
  const gradeOptions = gradesGeradas.map((g) => ({
    value: String(g.id),
    label: `${g.nome} (${formatDateTime(g.criado_em)})`,
  }))

  const handleDeleteGrade = async () => {
    await deleteGrade(activeGrade!.id!)
    await queryClient.invalidateQueries({ queryKey: ['historicoGrades'] })
    // Volta para a grade mais recente que sobrou
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('gradeId')
        next.delete('aula')
        return next
      },
      { replace: true },
    )
    await refreshSchedule()
  }

  const handleDuplicateGrade = async (nome: string) => {
    const copia = await duplicarGrade(activeGrade!.id!, nome)
    await queryClient.invalidateQueries({ queryKey: ['historicoGrades'] })
    setParam('gradeId', String(copia.id))
  }

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
  const editing = lessons.find((l) => String(l.id) === params.get('aula'))

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
      <div className="rounded-[20px] border-2 border-dashed border-line bg-white/60 p-12 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink text-white">
          <Icon name="grid" width={26} height={26} />
        </span>
        <h2 className="mt-4 font-display text-[20px] font-bold">Nenhuma grade gerada ainda</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">
          Gere a primeira grade para ver aqui as aulas de cada turma, resolver conflitos e exportar relatórios.
        </p>
        <Link to={paths.geracao} className={buttonStyles({}, 'mt-6')}>
          Gerar grade
        </Link>
      </div>
    )
  }

  const origem = historico.find((g) => g.id === activeGrade?.detalhes?.copia_de)
  const turmaLessons = lessons.filter((l) => l.classGroup === classGroup)
  const turmaSlots = turmaLessons.length ? horariosTurmas[turmaLessons[0].turmaId] : undefined
  const planejamentos = (activeGrade?.detalhes?.planejamentos ?? []).filter((p) => p.professor === teacher)
  const janelas = (activeGrade?.detalhes?.janelas ?? []).filter((j) => j.professor === teacher)

  return (
    <>
      <h2 className="sr-only">Grade da turma {classGroup}</h2>

      {/* Grade exibida + ações sobre ela */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted">
          {[origem && `Cópia de ${origem.nome}`, `${lessons.length} aulas na semana`, `${availableTurmas.length} turmas`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {gradeOptions.length > 1 && (
            <FilterChip
              label="Grade"
              value={String(activeGrade?.id ?? '')}
              options={gradeOptions}
              onChange={(v) => setParam('gradeId', v)}
            />
          )}
          {activeGrade && (
            <Button variant="secondary" size="sm" onClick={() => setIsDuplicating(true)}>
              Duplicar
            </Button>
          )}
          {activeGrade && (
            <Button variant="secondary" size="sm" onClick={() => setIsDeleting(true)} className="text-danger">
              Excluir
            </Button>
          )}
        </div>
      </div>

      {/* Turmas: um clique troca a turma exibida */}
      <div className="card mb-4 p-2">
        <div role="tablist" aria-label="Turmas" className="flex gap-1 overflow-x-auto">
          {availableTurmas.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === classGroup}
              onClick={() => setParam('turma', t)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-[14px] font-medium whitespace-nowrap transition-colors',
                t === classGroup ? 'bg-ink font-semibold text-white' : 'text-muted hover:bg-paper hover:text-ink',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line-soft px-2 pt-2">
          <span className="text-[13px] text-muted">Destacar aulas de</span>
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
          {(teacher || room) && (
            <button
              type="button"
              onClick={() => {
                setParam('professor', null)
                setParam('sala', null)
              }}
              className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted hover:bg-paper hover:text-ink"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {(changes.length > 0 || undoMessage) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] shadow-(--shadow-float)">
          <p className={undoMessage && !undoMessage.ok ? 'text-danger' : 'text-muted'} role="status">
            {undoMessage ? undoMessage.text : `Última alteração: ${changes[0].descricao}`}
            {changes.length > 0 && ` · ${changes.length} alteraç${changes.length > 1 ? 'ões' : 'ão'} manual(is) nesta grade`}
          </p>
          {changes.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleUndo} disabled={isUndoing}>
              {isUndoing ? 'Desfazendo…' : 'Desfazer última alteração'}
            </Button>
          )}
        </div>
      )}

      <ScheduleGrid
        lessons={turmaLessons}
        timeSlots={turmaSlots}
        editingId={editing?.id}
        isDimmed={isDimmed}
        onSelect={(lesson) => setParam('aula', String(lesson.id))}
      />

      {teacher && planejamentos.length > 0 && (
        <p className="mt-3.5 text-[12.5px]">
          <span className="font-semibold">Planejamento de {teacher}:</span>{' '}
          {planejamentos
            .map((p) => `${p.dia_semana} ${p.horario}${p.compartilhado ? ' (compartilhado)' : ''}`)
            .join(' · ')}
        </p>
      )}

      {teacher && janelas.length > 0 && (
        <p className="mt-1.5 text-[12.5px] text-warning">
          <span className="font-semibold">Janelas de {teacher}:</span>{' '}
          {janelas.map((j) => `${j.dia_semana} ${j.horario}`).join(' · ')}
        </p>
      )}

      <p className="mt-3.5 text-[13px] text-muted">
        Clique numa aula para trocar professor, sala ou horário. Para manter a versão gerada, duplique a grade antes de
        editar.
      </p>

      {editing && <LessonEditDialog key={editing.id} lesson={editing} onClose={() => setParam('aula', null)} />}

      {isDuplicating && activeGrade && (
        <DuplicateGradeDialog
          grade={activeGrade}
          onClose={() => setIsDuplicating(false)}
          onConfirm={handleDuplicateGrade}
        />
      )}

      {isDeleting && activeGrade && (
        <DeleteGradeDialog grade={activeGrade} onClose={() => setIsDeleting(false)} onConfirm={handleDeleteGrade} />
      )}
    </>
  )
}

interface FilterChipProps {
  label: string
  value: string
  /** Texto simples (valor = rótulo) ou par valor/rótulo */
  options: readonly (string | { value: string; label: string })[]
  allLabel?: string
  onChange: (value: string) => void
}

function FilterChip({ label, value, options, allLabel, onChange }: FilterChipProps) {
  return (
    <label className="flex h-9 items-center gap-1 rounded-full border border-line bg-white pr-1.5 pl-3.5 text-[13px] focus-within:border-ink">
      <span className="text-muted">{label}:</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-40 cursor-pointer bg-transparent py-1 pr-1 font-medium outline-none"
      >
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((option) => {
          const { value: v, label: l } = typeof option === 'string' ? { value: option, label: option } : option
          return (
            <option key={v} value={v}>
              {l}
            </option>
          )
        })}
      </select>
    </label>
  )
}
