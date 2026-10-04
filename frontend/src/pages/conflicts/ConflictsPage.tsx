import { useState } from 'react'
import { Link } from 'react-router'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Conflict } from '@/mocks/schedule'
import { useSchedule } from '@/schedule/useSchedule'
import { ConflictCard } from './ConflictCard'

function scheduleHref(classGroup: string, lessonId?: string) {
  const params = new URLSearchParams({ turma: classGroup })
  if (lessonId) params.set('aula', lessonId)
  return `/grade?${params}`
}

export function ConflictsPage() {
  const { conflicts, lessons, applySuggestion } = useSchedule()
  const [notice, setNotice] = useState<{ ok: boolean; text: string; classGroup?: string } | null>(null)

  const classGroupOf = (conflict: Conflict) =>
    lessons.find((l) => l.id === conflict.lessonId)?.classGroup ?? ''

  const handleApply = (conflict: Conflict) => {
    const classGroup = classGroupOf(conflict)
    const result = applySuggestion(conflict.id)
    setNotice(
      result.ok
        ? { ok: true, text: `Sugestão aplicada: ${conflict.suggestion}`, classGroup }
        : { ok: false, text: `Não foi possível aplicar a sugestão. ${result.error}` },
    )
  }

  const count = conflicts.length

  return (
    <div className="max-w-[760px]">
      <PageHeader
        title="Conflitos"
        description={
          count > 0
            ? `${count} ${count === 1 ? 'conflito detectado' : 'conflitos detectados'} na última geração. Resolva ou aplique as sugestões automáticas.`
            : undefined
        }
      />

      {notice && (
        <div
          role="status"
          className={
            notice.ok
              ? 'mb-4 rounded-lg border border-primary-soft-line bg-primary-soft px-4 py-3 text-[13px]'
              : 'mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-[13px]'
          }
        >
          {notice.text}{' '}
          {notice.classGroup && (
            <Link to={scheduleHref(notice.classGroup)} className="font-medium text-primary hover:underline">
              Ver na grade →
            </Link>
          )}
        </div>
      )}

      {count === 0 ? (
        <div className="rounded-lg border border-line bg-white px-6 py-8">
          <p className="text-sm font-semibold">Nenhum conflito pendente</p>
          <p className="mt-1 text-[13px] text-muted">A grade está pronta para publicação.</p>
          <Link to="/grade" className={buttonStyles({ variant: 'secondary', size: 'sm' }, 'mt-4')}>
            Ver grade
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {conflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              editHref={scheduleHref(classGroupOf(conflict), conflict.lessonId)}
              onApply={() => handleApply(conflict)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
