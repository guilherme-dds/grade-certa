import { useState } from 'react'
import { Link } from 'react-router'
import type { ConflitoGrade } from '@/api/grades'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { paths } from '@/config/paths'
import { TabHeader } from '@/layouts/SectionLayout'
import { useSchedule } from '@/schedule/useSchedule'
import { ConflictCard } from './ConflictCard'

function scheduleHref(classGroup: string, lessonId?: number) {
  const params = new URLSearchParams({ turma: classGroup })
  if (lessonId) params.set('aula', String(lessonId))
  return `${paths.grade}?${params}`
}

export function ConflictsPage() {
  const { conflicts, activeGrade, isLoading, applySuggestion } = useSchedule()
  const [notice, setNotice] = useState<{ ok: boolean; text: string; classGroup?: string } | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)

  const handleApply = async (conflict: ConflitoGrade) => {
    setApplyingId(conflict.id)
    const result = await applySuggestion(conflict.id)
    setApplyingId(null)
    setNotice(
      result.ok
        ? { ok: true, text: `Sugestão aplicada: ${conflict.sugestao}`, classGroup: conflict.turma_nome }
        : { ok: false, text: `Não foi possível aplicar a sugestão. ${result.error}` },
    )
  }

  const count = conflicts.length

  return (
    <div className="max-w-[760px]">
      <TabHeader
        title="Conflitos"
        description={
          count > 0
            ? `${count} ${count === 1 ? 'aula está' : 'aulas estão'} em choque depois das edições manuais. Aplique a sugestão ou edite na grade.`
            : 'Choques de horário criados por edições manuais aparecem aqui.'
        }
      />

      {notice && (
        <div
          role="status"
          className={
            notice.ok
              ? 'mb-4 rounded-2xl border border-primary-soft-line bg-primary-soft px-4 py-3 text-[13px]'
              : 'mb-4 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-[13px]'
          }
        >
          {notice.text}{' '}
          {notice.classGroup && (
            <Link to={scheduleHref(notice.classGroup)} className="font-medium text-primary hover:underline">
              Ver na grade
            </Link>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted">Carregando conflitos...</p>
      ) : !activeGrade ? (
        <div className="card px-6 py-8">
          <p className="text-sm font-semibold">Nenhuma grade gerada</p>
          <p className="mt-1 text-[13px] text-muted">Os conflitos aparecem depois que uma grade é gerada e editada.</p>
          <Link to={paths.geracao} className={buttonStyles({ variant: 'secondary', size: 'sm' }, 'mt-4')}>
            Gerar grade
          </Link>
        </div>
      ) : count === 0 ? (
        <div className="card px-6 py-8">
          <p className="text-sm font-semibold">Nenhum conflito pendente</p>
          <p className="mt-1 text-[13px] text-muted">Nenhuma aula em choque. A grade está pronta para publicar.</p>
          <Link to={paths.grade} className={buttonStyles({ variant: 'secondary', size: 'sm' }, 'mt-4')}>
            Ver grade
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {conflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              editHref={scheduleHref(conflict.turma_nome, conflict.aula_id)}
              onApply={() => handleApply(conflict)}
              isApplying={applyingId === conflict.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
