import { useEffect, useRef, useState, type FormEvent } from 'react'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/Button'
import { rooms, timeSlots, weekDays } from '@/mocks/data'
import { subjectsMeta, teachers, type Lesson, type TimeSlot, type WeekDay } from '@/mocks/schedule'
import { useSchedule } from '@/schedule/useSchedule'

const roomNames = rooms.map((r) => r.name)

interface LessonEditDialogProps {
  lesson: Lesson
  onClose: () => void
}

export function LessonEditDialog({ lesson, onClose }: LessonEditDialogProps) {
  const { updateLesson } = useSchedule()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [values, setValues] = useState({
    teacher: lesson.teacher,
    room: lesson.room,
    day: lesson.day,
    time: lesson.time,
  })
  const [error, setError] = useState<string | null>(null)

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
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const changed = (Object.keys(values) as (keyof typeof values)[]).some((k) => values[k] !== lesson[k])
    if (!changed) return close()
    const result = updateLesson(lesson.id, values)
    if (result.ok) close()
    else setError(result.error)
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
          Editar aula — {subjectsMeta[lesson.subject].name} · {lesson.classGroup}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Atualmente em {lesson.day}, {lesson.time}.
        </p>

        <div className="mt-5 space-y-4">
          <SelectField
            label="Professor"
            options={teachers}
            value={values.teacher}
            onChange={(e) => set('teacher', e.target.value)}
          />
          <SelectField
            label="Sala"
            options={roomNames}
            value={values.room}
            onChange={(e) => set('room', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Dia"
              options={weekDays}
              value={values.day}
              onChange={(e) => set('day', e.target.value as WeekDay)}
            />
            <SelectField
              label="Horário"
              options={timeSlots}
              value={values.time}
              onChange={(e) => set('time', e.target.value as TimeSlot)}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-[13px] text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </dialog>
  )
}
