import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ConflitoGrade } from '@/api/grades'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Icon } from '@/components/ui/Icon'
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
    <>
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
        <EmptyState
          title="Nenhuma grade gerada"
          text="Os conflitos aparecem depois que uma grade é gerada e editada à mão."
          action={
            <Link to={paths.geracao} className={buttonStyles()}>
              Gerar grade
            </Link>
          }
        />
      ) : count === 0 ? (
        <EmptyState
          ok
          title="Nenhum conflito pendente"
          text="Nenhuma aula está em choque. Se mover aulas na grade e criar um choque, ele aparece aqui com uma sugestão de ajuste."
          action={
            <>
              <Link to={paths.grade} className={buttonStyles()}>
                Ver grade por turma
              </Link>
              <Link to={paths.resumo} className={buttonStyles({ variant: 'secondary' })}>
                Ver resumo
              </Link>
            </>
          }
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 2xl:grid-cols-2">
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
    </>
  )
}

function EmptyState({ title, text, action, ok }: { title: string; text: string; action: ReactNode; ok?: boolean }) {
  return (
    <div className="card flex flex-col gap-5 p-6 md:flex-row md:items-center md:p-8">
      <span
        className={
          ok
            ? 'grid size-14 shrink-0 place-items-center rounded-full bg-accent text-ink'
            : 'grid size-14 shrink-0 place-items-center rounded-full bg-paper text-muted'
        }
      >
        <Icon name={ok ? 'check' : 'conflict'} width={26} height={26} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-[20px] font-bold">{title}</h3>
        <p className="mt-1 max-w-[60ch] text-[14px] leading-relaxed text-muted">{text}</p>
      </div>
      <div className="flex flex-wrap gap-2">{action}</div>
    </div>
  )
}
