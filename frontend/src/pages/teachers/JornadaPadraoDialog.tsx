import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { saveJornadaPadrao, type Jornada } from '@/api/configuracoes'
import { Button } from '@/components/ui/Button'
import { getApiErrorMessage } from '@/lib/apiError'
import { validarJornada, type JornadaErrors } from './jornada'
import { JornadaFields } from './JornadaFields'

interface JornadaPadraoDialogProps {
  jornada: Jornada
  onClose: () => void
}

export function JornadaPadraoDialog({ jornada, onClose }: JornadaPadraoDialogProps) {
  const queryClient = useQueryClient()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(jornada)
  const [errors, setErrors] = useState<JornadaErrors>({})
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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
    const erros = validarJornada(value)
    setErrors(erros)
    if (Object.keys(erros).length > 0) return

    setIsSaving(true)
    setSaveError('')
    try {
      const salva = await saveJornadaPadrao(value)
      queryClient.setQueryData(['jornadaPadrao'], salva)
      close()
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Não foi possível salvar a jornada padrão.'))
      setIsSaving(false)
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
      aria-labelledby="jornada-dialog-title"
      className="m-auto w-[min(460px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h2 id="jornada-dialog-title" className="text-[17px] font-semibold">
          Jornada padrão da escola
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Vale para todos os professores sem jornada personalizada, nas próximas gerações de grade. Grades já geradas não
          mudam.
        </p>

        <div className="mt-5">
          <JornadaFields value={value} errors={errors} onChange={setValue} />
          <p className="mt-2 text-xs text-muted">
            Com duração 0, o almoço deixa de ser exigido. O professor fica sem aula e sem planejamento durante esses
            minutos, em algum momento da faixa.
          </p>
        </div>

        {saveError && <p className="mt-4 text-[13px] text-danger">{saveError}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar padrão'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
