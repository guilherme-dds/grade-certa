import { useState } from 'react'
import type { ProfessorBackend } from '@/api/professores'
import { ProfessorAvailabilityEditor } from '@/components/ProfessorAvailabilityEditor'
import { Sheet } from '@/components/ui/Sheet'

interface TeacherAvailabilityDialogProps {
  professor: ProfessorBackend
  onClose: () => void
}

export function TeacherAvailabilityDialog({ professor, onClose }: TeacherAvailabilityDialogProps) {
  const [dirty, setDirty] = useState(false)

  return (
    <Sheet
      width="xl"
      dirty={dirty}
      onClose={onClose}
      title={`Disponibilidade de ${professor.nome}`}
      description="Tudo começa livre. Marque os horários em que o professor não pode dar aula e, se quiser, os que ele prefere: o gerador tenta usá-los primeiro."
    >
      <ProfessorAvailabilityEditor professor={professor} onSaved={onClose} onDirty={() => setDirty(true)} />
    </Sheet>
  )
}
