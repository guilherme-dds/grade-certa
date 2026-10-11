import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FormField } from '@/components/FormField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/Button'
import { TIPOS_SALA, type SalaBackend } from '@/api/salas'
import { getApiErrorMessage } from '@/lib/apiError'

interface SalaDialogProps {
  sala?: SalaBackend | null
  /** Salas já cadastradas, para impedir nomes repetidos */
  salas: SalaBackend[]
  onClose: () => void
  onSave: (sala: Omit<SalaBackend, 'id'> & { id?: number }) => Promise<void>
}

interface SalaErrors {
  nome?: string
  capacidade?: string
  form?: string
}

export function SalaDialog({ sala, salas, onClose, onSave }: SalaDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [nome, setNome] = useState(sala?.nome ?? '')
  const [capacidade, setCapacidade] = useState(sala ? String(sala.capacidade) : '')
  const [tipo, setTipo] = useState<string>(sala?.tipo ?? TIPOS_SALA[0])
  const [errors, setErrors] = useState<SalaErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }
  }, [])

  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedNome = nome.trim()
    const capacidadeNum = Number(capacidade)
    const nextErrors: SalaErrors = {}

    if (!trimmedNome) {
      nextErrors.nome = 'Informe o nome da sala.'
    } else if (
      salas.some(
        (s) => s.id !== sala?.id && s.nome.toLowerCase() === trimmedNome.toLowerCase(),
      )
    ) {
      nextErrors.nome = 'Já existe uma sala com esse nome.'
    }
    if (!capacidade || !Number.isInteger(capacidadeNum) || capacidadeNum <= 0) {
      nextErrors.capacidade = 'Informe uma capacidade maior que zero.'
    }

    setErrors(nextErrors)
    if (nextErrors.nome || nextErrors.capacidade) return

    try {
      setIsSubmitting(true)
      await onSave({
        id: sala?.id,
        nome: trimmedNome,
        capacidade: capacidadeNum,
        tipo,
      })
      close()
    } catch (err) {
      console.error(err)
      setErrors({ form: getApiErrorMessage(err, 'Erro ao salvar sala. Tente novamente.') })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      aria-labelledby="sala-dialog-title"
      className="m-auto w-[min(460px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} noValidate className="p-6">
        <h3 id="sala-dialog-title" className="text-[17px] font-semibold">
          {sala ? 'Editar Sala' : 'Nova Sala'}
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          {sala
            ? 'Altere as informações da sala selecionada.'
            : 'Cadastre uma sala com sua capacidade e tipo.'}
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <FormField
            label="Nome da sala"
            placeholder="Ex.: Sala 103, Laboratório de Informática..."
            value={nome}
            onChange={(e) => {
              setNome(e.target.value)
              if (errors.nome) setErrors((prev) => ({ ...prev, nome: undefined }))
            }}
            error={errors.nome}
            autoFocus
          />

          <FormField
            label="Capacidade (alunos)"
            type="number"
            min={1}
            step={1}
            placeholder="Ex.: 35"
            value={capacidade}
            onChange={(e) => {
              setCapacidade(e.target.value)
              if (errors.capacidade) setErrors((prev) => ({ ...prev, capacidade: undefined }))
            }}
            error={errors.capacidade}
          />

          <SelectField
            label="Tipo"
            options={TIPOS_SALA}
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          />
        </div>

        {errors.form && <p className="mt-4 text-xs text-danger">{errors.form}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : sala ? 'Salvar alterações' : 'Cadastrar sala'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
