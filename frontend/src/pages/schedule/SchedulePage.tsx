import { useSearchParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { PageHeader } from '@/components/ui/PageHeader'
import { rooms } from '@/mocks/data'
import { classGroups, teachers, type Lesson } from '@/mocks/schedule'
import { useSchedule } from '@/schedule/useSchedule'
import { LessonEditDialog } from './LessonEditDialog'
import { ScheduleGrid } from './ScheduleGrid'

const roomNames = rooms.map((r) => r.name)

// Filtros e aula em edição ficam na URL: /grade?turma=6ºA&professor=…&sala=…&aula=<id>
export function SchedulePage() {
  const { role } = useAuth()
  const { lessons } = useSchedule()
  const [params, setParams] = useSearchParams()

  const classGroup = classGroups.find((c) => c === params.get('turma')) ?? classGroups[0]
  const teacher = params.get('professor') ?? ''
  const room = params.get('sala') ?? ''
  const canEdit = role === 'coordenacao'
  const editing = canEdit ? lessons.find((l) => l.id === params.get('aula')) : undefined

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

  const isDimmed = (l: Lesson) => (teacher !== '' && l.teacher !== teacher) || (room !== '' && l.room !== room)

  return (
    <>
      <PageHeader
        title={`Grade — ${classGroup}`}
        actions={
          <>
            <FilterChip label="Turma" value={classGroup} options={classGroups} onChange={(v) => setParam('turma', v)} />
            <FilterChip
              label="Professor"
              value={teacher}
              options={teachers}
              allLabel="Todos"
              onChange={(v) => setParam('professor', v)}
            />
            <FilterChip
              label="Sala"
              value={room}
              options={roomNames}
              allLabel="Todas"
              onChange={(v) => setParam('sala', v)}
            />
          </>
        }
      />

      <ScheduleGrid
        lessons={lessons.filter((l) => l.classGroup === classGroup)}
        editingId={editing?.id}
        isDimmed={isDimmed}
        onSelect={canEdit ? (lesson) => setParam('aula', lesson.id) : undefined}
      />

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
  /** Rótulo da opção "sem filtro"; sem ele o filtro é obrigatório */
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
