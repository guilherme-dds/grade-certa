import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { cn } from '@/lib/cn'
import type { Conflict, ConflictSeverity } from '@/mocks/schedule'

const severityStyles: Record<ConflictSeverity, { label: string; border: string; text: string }> = {
  alto: { label: 'Alto', border: 'border-l-danger', text: 'text-danger' },
  medio: { label: 'Médio', border: 'border-l-warning', text: 'text-warning' },
}

interface ConflictCardProps {
  conflict: Conflict
  /** Link para a grade com a aula do conflito já aberta para edição */
  editHref: string
  onApply: () => void
}

export function ConflictCard({ conflict, editHref, onApply }: ConflictCardProps) {
  const severity = severityStyles[conflict.severity]

  return (
    <article className={cn('rounded-lg border border-l-4 border-line bg-white px-[18px] py-4', severity.border)}>
      <p className={cn('text-[11px] font-bold tracking-[0.04em] uppercase', severity.text)}>
        {severity.label} · {conflict.kind}
      </p>
      <p className="mt-1.5 text-sm">{conflict.description}</p>
      <p className="mt-1.5 text-[12.5px] text-muted">Sugestão: {conflict.suggestion}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onApply}>
          Aplicar sugestão
        </Button>
        <Link to={editHref} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
          Editar manualmente
        </Link>
      </div>
    </article>
  )
}
