import { useState } from 'react'
import type { ProfessorBackend } from '@/api/professores'
import { ProfessorAvailabilityEditor } from '@/components/ProfessorAvailabilityEditor'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'

interface TeacherAvailabilityDialogProps {
  professor: ProfessorBackend
  onClose: () => void
}

export function TeacherAvailabilityDialog({ professor, onClose }: TeacherAvailabilityDialogProps) {
  const [dirty, setDirty] = useState(false)
  const toast = useToast()

  return (
    <Sheet
      width="xl"
      dirty={dirty}
      onClose={onClose}
      title={`Disponibilidade de ${professor.nome}`}
      description="Tudo começa livre. Marque os horários em que o professor não pode dar aula e, se quiser, os que ele prefere evitar: o gerador só os usa se não houver outro jeito."
    >
      <ProfessorAvailabilityEditor
        professor={professor}
        onSaved={() => {
          toast(`Disponibilidade de ${professor.nome} salva`)
          onClose()
        }}
        onDirty={() => setDirty(true)}
      />
    </Sheet>
  )
}
