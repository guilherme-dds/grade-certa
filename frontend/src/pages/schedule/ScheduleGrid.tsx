import { cn } from '@/lib/cn'
import { timeSlots, weekDays } from '@/mocks/data'
import { roomShortNames, shortTeacherName, subjectsMeta, type Lesson } from '@/mocks/schedule'

interface ScheduleGridProps {
  lessons: Lesson[]
  /** Aula com edição em andamento (destaque do design) */
  editingId?: string | null
  isDimmed?: (lesson: Lesson) => boolean
  /** Sem esta prop a grade é somente leitura */
  onSelect?: (lesson: Lesson) => void
}

export function ScheduleGrid({ lessons, editingId, isDimmed, onSelect }: ScheduleGridProps) {
  const bySlot = new Map(lessons.map((l) => [`${l.day}|${l.time}`, l]))

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[640px] table-fixed border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-paper">
            <th scope="col" className="w-[70px] p-2">
              <span className="sr-only">Horário</span>
            </th>
            {weekDays.map((day) => (
              <th key={day} scope="col" className="p-2 font-semibold">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((time) => (
            <tr key={time} className="border-t border-line-soft">
              <th scope="row" className="p-2 text-left font-mono font-normal text-muted">
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
                      <div className="px-2 py-1.5 text-line" aria-label={`${day}, ${time}: sem aula`}>
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
  const meta = subjectsMeta[lesson.subject]
  const detail = `${shortTeacherName(lesson.teacher)} · ${roomShortNames[lesson.room] ?? lesson.room}`
  const className = cn(
    'block w-full rounded-[5px] px-2 py-1.5 text-left transition-opacity',
    editing ? 'bg-primary outline-2 outline-offset-2 outline-navy' : meta.color,
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
      <div className={className} title={`${meta.name} — ${lesson.teacher}, ${lesson.room}`}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(lesson)}
      aria-label={`Editar ${meta.name}, ${lesson.day} ${lesson.time} — ${lesson.teacher}, ${lesson.room}`}
      className={cn(
        className,
        'cursor-pointer hover:ring-1 hover:ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      )}
    >
      {content}
    </button>
  )
}
