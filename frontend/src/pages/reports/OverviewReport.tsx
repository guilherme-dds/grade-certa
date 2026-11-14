import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import { paths } from '@/config/paths'
import { cn } from '@/lib/cn'
import type { Lesson } from '@/schedule/ScheduleContext'
import { percentual, type CargaProfessor, type OcupacaoSala } from './reportMetrics'

interface OverviewReportProps {
  lessons: Lesson[]
  conflitos: number
  cargas: CargaProfessor[]
  ocupacoes: OcupacaoSala[]
  avisos?: string[]
}

/** Resumo da grade: indicadores no topo, carga dos professores à esquerda e o restante ao lado. */
export function OverviewReport({ lessons, conflitos, cargas, ocupacoes, avisos }: OverviewReportProps) {
  const comAulas = cargas.filter((c) => c.aulas > 0)
  const cargaMedia = comAulas.reduce((total, c) => total + c.aulas, 0) / (comAulas.length || 1)
  const ocupacao = percentual(
    ocupacoes.reduce((total, o) => total + o.minutosOcupados, 0),
    ocupacoes.reduce((total, o) => total + o.minutosDisponiveis, 0),
  )
  const semJanela = percentual(cargas.filter((c) => c.janelas === 0).length, cargas.length)
  const semSala = lessons.filter((l) => !l.room).length
  const semProfessor = lessons.filter((l) => l.teachers.length === 0).length
  const turmas = new Set(lessons.map((l) => l.classGroup)).size
  // Sem carga máxima no cadastro, a barra usa a maior carga da lista como referência
  const maiorCarga = Math.max(1, ...cargas.map((c) => c.aulas))

  return (
    <div className="space-y-4">
      <StatGrid>
        <StatCard
          label="Carga média docente"
          value={cargaMedia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          suffix="aulas por semana"
        />
        <StatCard label="Ocupação de salas" value={`${ocupacao}%`} suffix="do tempo disponível" />
        <StatCard
          label="Conflitos pendentes"
          value={conflitos}
          tone={conflitos > 0 ? 'danger' : 'success'}
          suffix={conflitos > 0 ? 'precisam de ajuste' : 'nenhum choque'}
        />
        <StatCard
          label="Professores sem janela"
          value={`${semJanela}%`}
          tone={semJanela === 100 ? 'success' : 'warning'}
          suffix="sem horário vago entre aulas"
        />
      </StatGrid>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px] print:block">
        <section className="card p-5 md:p-6" aria-labelledby="carga-professores">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="carga-professores" className="font-display text-[18px] font-bold">
              Carga horária por professor
            </h2>
            <p className="text-[12.5px] text-muted">Barra em relação à carga máxima do cadastro</p>
          </div>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-line-soft text-left text-[12.5px] text-muted">
                  <th scope="col" className="w-[190px] pb-2 pr-3 font-medium">
                    Professor
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    <span className="sr-only">Proporção da carga</span>
                  </th>
                  <th scope="col" className="w-[110px] pb-2 pr-3 text-right font-medium">
                    Aulas
                  </th>
                  <th scope="col" className="w-[110px] pb-2 pr-3 text-right font-medium">
                    Planejamentos
                  </th>
                  <th scope="col" className="w-[70px] pb-2 text-right font-medium">
                    Janelas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {cargas.map((carga) => {
                  const acimaDoLimite = carga.cargaMaxima != null && carga.aulas > carga.cargaMaxima
                  const largura = percentual(carga.aulas, carga.cargaMaxima ?? maiorCarga)
                  return (
                    <tr key={carga.nome}>
                      <th scope="row" className="truncate py-2 pr-3 text-left font-medium">
                        {carga.nome}
                      </th>
                      <td className="py-2 pr-4">
                        <div
                          className="h-2 rounded-full bg-line-soft"
                          title={
                            carga.cargaMaxima != null
                              ? `${carga.nome}: ${carga.aulas} de ${carga.cargaMaxima} aulas (${largura}%)`
                              : `${carga.nome}: ${carga.aulas} aulas (sem carga máxima no cadastro)`
                          }
                        >
                          <div
                            className={cn('h-full rounded-full', acimaDoLimite ? 'bg-danger' : 'bg-primary')}
                            style={{ width: `${Math.min(largura, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                        <span className={cn('font-semibold', acimaDoLimite && 'text-danger')}>{carga.aulas}</span>
                        {carga.cargaMaxima != null && <span className="text-muted"> de {carga.cargaMaxima}</span>}
                        {acimaDoLimite && <span className="block text-[11.5px] text-danger">acima do limite</span>}
                      </td>
                      <td className="py-2 pr-3 text-right text-muted tabular-nums">{carga.planejamentos}</td>
                      <td
                        className={cn(
                          'py-2 text-right tabular-nums',
                          carga.janelas >= 4 ? 'font-semibold text-warning' : 'text-muted',
                        )}
                      >
                        {carga.janelas}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-4 print:mt-4">
          <section className="card p-5 md:p-6" aria-labelledby="resumo-grade">
            <h2 id="resumo-grade" className="mb-3 font-display text-[18px] font-bold">
              Resumo da grade
            </h2>
            <dl className="divide-y divide-line-soft text-[14px]">
              <Fact label="Aulas alocadas" value={lessons.length} />
              <Fact label="Turmas" value={turmas} />
              <Fact label="Professores com aula" value={comAulas.length} />
              <Fact label="Aulas sem sala" value={semSala} tone={semSala > 0 ? 'warning' : undefined} />
              <Fact label="Aulas sem professor" value={semProfessor} tone={semProfessor > 0 ? 'danger' : undefined} />
            </dl>
          </section>

          <section className="card p-5 md:p-6" aria-labelledby="ocupacao-salas">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="ocupacao-salas" className="font-display text-[18px] font-bold">
                Ocupação das salas
              </h2>
              {ocupacoes.length > 0 && (
                <Link
                  to={paths.gradeSalas}
                  className="text-[13px] font-semibold text-primary hover:underline print:hidden"
                >
                  Ver horários
                </Link>
              )}
            </div>
            {ocupacoes.length === 0 ? (
              <p className="text-[13.5px] text-muted">Nenhuma sala cadastrada: a grade foi gerada sem alocar salas.</p>
            ) : (
              <ul className="space-y-3">
                {ocupacoes.map((o) => {
                  const pct = percentual(o.minutosOcupados, o.minutosDisponiveis)
                  return (
                    <li key={o.nome}>
                      <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                        <span className="truncate font-medium">{o.nome}</span>
                        <span className="shrink-0 text-muted tabular-nums">
                          <span className="font-semibold text-ink">{pct}%</span> · {o.aulas.length} aulas
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-line-soft">
                        <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {avisos && avisos.length > 0 && (
            <section className="card p-5 md:p-6" aria-labelledby="avisos-geracao">
              <h2 id="avisos-geracao" className="mb-2 font-display text-[18px] font-bold">
                Avisos da geração
              </h2>
              <ul className="space-y-2 text-[13.5px]">
                {avisos.map((aviso) => (
                  <li key={aviso} className="rounded-xl bg-warning-soft px-3.5 py-2.5 leading-relaxed">
                    {aviso}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Fact({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'warning' | 'danger'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt>
        {label}
        {hint && <span className="block text-[12.5px] text-muted">{hint}</span>}
      </dt>
      <dd
        className={cn(
          'font-display text-[18px] font-bold tabular-nums',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
