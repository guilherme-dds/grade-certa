import { useState, type FormEvent } from 'react'
import { useUnsavedChangesGuard } from '@/components/ui/ConfirmDialog'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getJornadaPadrao, saveJornadaPadrao, type Jornada } from '@/api/configuracoes'
import { getProfessores } from '@/api/professores'
import { Button } from '@/components/ui/Button'
import { paths } from '@/config/paths'
import { TabHeader } from '@/layouts/SectionLayout'
import { getApiErrorMessage } from '@/lib/apiError'
import { validarJornada, type JornadaErrors } from '@/pages/teachers/jornada'
import { JornadaFields } from '@/pages/teachers/JornadaFields'

export function EscolaPage() {
  const jornadaQuery = useQuery({ queryKey: ['jornadaPadrao'], queryFn: getJornadaPadrao })

  return (
    <>
      <TabHeader
        title="Escola"
        description="Regras que valem para a escola inteira nas próximas gerações. Grades já geradas não mudam."
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        {jornadaQuery.isLoading ? (
          <div className="card h-[420px] animate-pulse" />
        ) : jornadaQuery.data ? (
          <JornadaForm saved={jornadaQuery.data} />
        ) : (
          <p role="alert" className="card p-6 text-[14px] text-danger">
            Não foi possível carregar a jornada padrão.
          </p>
        )}
        <JornadaAside />
      </div>
    </>
  )
}

function JornadaForm({ saved }: { saved: Jornada }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(saved)
  const [errors, setErrors] = useState<JornadaErrors>({})
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const changed = JSON.stringify(value) !== JSON.stringify(saved)
  useUnsavedChangesGuard(changed)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const erros = validarJornada(value)
    setErrors(erros)
    if (Object.keys(erros).length > 0) return
    setIsSaving(true)
    setStatus(null)
    try {
      const salva = await saveJornadaPadrao(value)
      queryClient.setQueryData(['jornadaPadrao'], salva)
      setStatus({ ok: true, text: 'Jornada padrão salva.' })
    } catch (err) {
      setStatus({ ok: false, text: getApiErrorMessage(err, 'Não foi possível salvar a jornada padrão.') })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 md:p-7">
      <h3 className="font-display text-[18px] font-bold">Jornada padrão dos professores</h3>
      <p className="mt-1 text-[14px] text-muted">
        Vale para quem não tem jornada própria (definida no cadastro do professor).
      </p>

      <div className="mt-5">
        <JornadaFields value={value} errors={errors} onChange={setValue} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSaving || !changed}>
          {isSaving ? 'Salvando…' : 'Salvar jornada'}
        </Button>
        {changed && (
          <Button variant="secondary" onClick={() => setValue(saved)}>
            Descartar alterações
          </Button>
        )}
        {status && (
          <p
            role="status"
            className={status.ok ? 'text-[13.5px] font-semibold text-primary' : 'text-[13.5px] text-danger'}
          >
            {status.text}
          </p>
        )}
      </div>
    </form>
  )
}

/** Como a jornada entra na geração e quem foge do padrão */
function JornadaAside() {
  const professoresQuery = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() })
  const proprios = (professoresQuery.data ?? []).filter((p) => p.ativo && p.jornada)

  return (
    <aside className="space-y-4">
      <section className="card p-6">
        <h3 className="font-display text-[16px] font-bold">Como o gerador usa a jornada</h3>
        <ul className="mt-3 space-y-2.5 text-[13.5px] leading-relaxed text-muted">
          <li>
            <span className="font-semibold text-ink">Almoço:</span> o professor fica sem aula e sem planejamento pelos
            minutos informados, em algum momento da faixa. Com duração 0, o almoço deixa de ser exigido.
          </li>
          <li>
            <span className="font-semibold text-ink">Aulas por dia:</span> limite de aulas do professor num mesmo dia.
          </li>
          <li>
            <span className="font-semibold text-ink">Horas no dia:</span> contam da primeira à última aula ou
            planejamento.
          </li>
        </ul>
      </section>

      <section className="card p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-[16px] font-bold">Com jornada própria</h3>
          <span className="text-[13px] text-muted tabular-nums">{proprios.length}</span>
        </div>
        {professoresQuery.isLoading ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-paper" />
        ) : proprios.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-muted">Todos os professores ativos seguem o padrão da escola.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {proprios.map((p) => (
              <li key={p.id} className="rounded-full bg-paper px-3 py-1 text-[13px] font-medium">
                {p.nome}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[13px] text-muted">
          A jornada própria é definida no{' '}
          <Link to={paths.professores} className="font-semibold text-primary hover:underline">
            cadastro do professor
          </Link>
          .
        </p>
      </section>
    </aside>
  )
}
