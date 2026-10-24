import { Link } from 'react-router'
import type { ConflitoGrade, GravidadeConflito } from '@/api/grades'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { cn } from '@/lib/cn'

const severityStyles: Record<GravidadeConflito, { label: string; border: string; text: string }> = {
  alto: { label: 'Alto', border: 'border-l-danger', text: 'text-danger' },
  medio: { label: 'Médio', border: 'border-l-warning', text: 'text-warning' },
}

interface ConflictCardProps {
  conflict: ConflitoGrade
  /** Link para a grade com a aula do conflito já aberta para edição */
  editHref: string
  onApply: () => void
  isApplying?: boolean
}

export function ConflictCard({ conflict, editHref, onApply, isApplying }: ConflictCardProps) {
  const severity = severityStyles[conflict.gravidade]

  return (
    <article className={cn('rounded-lg border border-l-4 border-line bg-white px-[18px] py-4', severity.border)}>
      <p className={cn('text-[11px] font-bold tracking-[0.04em] uppercase', severity.text)}>
        {severity.label} · {conflict.tipo}
      </p>
      <p className="mt-1.5 text-sm">{conflict.descricao}</p>
      <p className="mt-1.5 text-[12.5px] text-muted">
        {conflict.sugestao ? `Sugestão: ${conflict.sugestao}` : 'Sem horário livre para sugerir; edite a aula manualmente.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {conflict.correcao && (
          <Button size="sm" onClick={onApply} disabled={isApplying}>
            {isApplying ? 'Aplicando...' : 'Aplicar sugestão'}
          </Button>
        )}
        <Link to={editHref} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
          Editar manualmente
        </Link>
      </div>
    </article>
  )
}
