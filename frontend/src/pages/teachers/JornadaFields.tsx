import type { Jornada } from '@/api/configuracoes'
import { FormField } from '@/components/FormField'
import type { JornadaErrors } from './jornada'

interface JornadaFieldsProps {
  value: Jornada
  errors: JornadaErrors
  onChange: (value: Jornada) => void
}

export function JornadaFields({ value, errors, onChange }: JornadaFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField
        label="Almoço a partir de"
        type="time"
        value={value.almoco_inicio}
        onChange={(e) => onChange({ ...value, almoco_inicio: e.target.value })}
        error={errors.almoco_inicio}
      />
      <FormField
        label="Almoço até"
        type="time"
        value={value.almoco_fim}
        onChange={(e) => onChange({ ...value, almoco_fim: e.target.value })}
        error={errors.almoco_fim}
      />
      <FormField
        label="Duração do almoço (min)"
        type="number"
        min={0}
        max={240}
        value={value.almoco_minutos}
        onChange={(e) => onChange({ ...value, almoco_minutos: Number(e.target.value) })}
        error={errors.almoco_minutos}
      />
      <FormField
        label="Máximo de aulas por dia"
        type="number"
        min={1}
        max={12}
        value={value.max_aulas_dia}
        onChange={(e) => onChange({ ...value, max_aulas_dia: Number(e.target.value) })}
        error={errors.max_aulas_dia}
      />
      <FormField
        label="Máximo de horas no dia (vazio = sem limite)"
        type="number"
        min={1}
        max={14}
        step={0.5}
        placeholder="sem limite"
        value={value.max_horas_dia ?? ''}
        onChange={(e) => onChange({ ...value, max_horas_dia: e.target.value === '' ? null : Number(e.target.value) })}
        error={errors.max_horas_dia}
      />
    </div>
  )
}
