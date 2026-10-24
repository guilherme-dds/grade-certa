import { cn } from '@/lib/cn'
import { getSubjectColor, shortTeacherName, weekDays } from '@/lib/schedule'
import type { Lesson } from '@/schedule/ScheduleContext'

interface ScheduleGridProps {
  lessons: Lesson[]
  /** Horários da turma; se ausente, usa os horários que aparecem nas aulas */
  timeSlots?: string[]
  /** Aula com edição em andamento (destaque do design) */
  editingId?: number | null
  isDimmed?: (lesson: Lesson) => boolean
  /** Sem esta prop a grade é somente leitura */
  onSelect?: (lesson: Lesson) => void
}

export function ScheduleGrid({ lessons, timeSlots, editingId, isDimmed, onSelect }: ScheduleGridProps) {
  const bySlot = new Map(lessons.map((l) => [`${l.day}|${l.time}`, l]))
  const slots = timeSlots?.length ? timeSlots : Array.from(new Set(lessons.map((l) => l.time))).sort()

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[640px] table-fixed border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-paper">
            <th scope="col" className="w-[100px] p-2 text-left text-xs font-semibold text-muted">
              Horário
            </th>
            {weekDays.map((day) => (
              <th key={day} scope="col" className="p-2 font-semibold">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((time) => (
            <tr key={time} className="border-t border-line-soft">
              <th scope="row" className="p-2 text-left font-mono font-normal whitespace-nowrap text-muted">
                {time}
              </th>
              {weekDays.map((day) => {
                const lesson = bySlot.get(`${day}|${time}`)
                return (
                  <td key={day} className="p-1.5 align-top">
                    {lesson ? (
                      <LessonCard
                        lesson={lesson}
                        editing={lesson.id === editingId}
                        dimmed={isDimmed?.(lesson) ?? false}
                        onSelect={onSelect}
                      />
                    ) : (
                      <div className="px-2 py-1.5 text-center text-line" aria-label={`${day}, ${time}: sem aula`}>
                        —
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface LessonCardProps {
  lesson: Lesson
  editing: boolean
  dimmed: boolean
  onSelect?: (lesson: Lesson) => void
}

function LessonCard({ lesson, editing, dimmed, onSelect }: LessonCardProps) {
  const names = lesson.teachers.map((t) => t.nome)
  const teachersShort = names.length ? names.map(shortTeacherName).join(' + ') : shortTeacherName(null)
  const detail = lesson.room ? `${teachersShort} · ${lesson.room}` : teachersShort
  const description = `${lesson.subject} — ${names.join(' e ') || 'sem professor'}${lesson.room ? `, ${lesson.room}` : ''}`
  const className = cn(
    'block w-full rounded-[5px] px-2 py-1.5 text-left transition-opacity',
    editing ? 'bg-primary outline-2 outline-offset-2 outline-navy' : getSubjectColor(lesson.subject),
    dimmed && !editing && 'opacity-30',
  )
  const content = (
    <>
      <span className={cn('block font-semibold', editing && 'text-white')}>
        {lesson.subject}
        {editing && ' ✎'}
      </span>
      <span className={cn('block truncate', editing ? 'text-primary-soft' : 'text-muted')}>{detail}</span>
    </>
  )

  if (!onSelect) {
    return (
      <div className={className} title={description}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(lesson)}
      aria-label={`Editar ${description}, ${lesson.day} ${lesson.time}`}
      className={cn(
        className,
        'cursor-pointer hover:ring-1 hover:ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      )}
    >
      {content}
    </button>
  )
}
