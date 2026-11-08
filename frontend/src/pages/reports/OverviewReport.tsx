import { GenerationWarnings } from '@/components/GenerationWarnings'
import { SectionHeader } from '@/components/ui/PageHeader'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
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

/** Resumo da grade (Claude Design · tela 08), com indicadores calculados dos dados reais. */
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
  // Sem carga máxima no cadastro, a barra usa a maior carga da lista como referência
  const maiorCarga = Math.max(1, ...cargas.map((c) => c.aulas))

  return (
    <div className="max-w-[760px] space-y-7 print:max-w-none">
      <div>
        <StatGrid>
          <StatCard
            label="Carga média docente"
            value={cargaMedia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
            suffix="aulas/sem"
          />
          <StatCard label="Ocupação de salas" value={`${ocupacao}%`} />
          <StatCard label="Conflitos pendentes" value={conflitos} tone={conflitos > 0 ? 'danger' : 'success'} />
          <StatCard
            label="Professores sem janela"
            value={`${semJanela}%`}
            tone={semJanela === 100 ? 'success' : 'warning'}
          />
        </StatGrid>
        <p className="mt-3 text-[12.5px] text-muted">
          {lessons.length} aulas alocadas · {semSala} sem sala · {semProfessor} sem professor
        </p>
      </div>

      <section>
        <SectionHeader title="Carga horária por professor" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="w-[170px] py-1.5 pr-3 font-medium">
                  Professor
                </th>
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  <span className="sr-only">Proporção da carga</span>
                </th>
                <th scope="col" className="w-[120px] py-1.5 pr-3 text-right font-medium">
                  Aulas
                </th>
                <th scope="col" className="w-[60px] py-1.5 pr-3 text-right font-medium">
                  Planej.
                </th>
                <th scope="col" className="w-[52px] py-1.5 text-right font-medium">
                  Janelas
                </th>
              </tr>
            </thead>
            <tbody>
              {cargas.map((carga) => {
                const acimaDoLimite = carga.cargaMaxima != null && carga.aulas > carga.cargaMaxima
                const largura = percentual(carga.aulas, carga.cargaMaxima ?? maiorCarga)
                return (
                  <tr key={carga.nome}>
                    <th scope="row" className="truncate py-1.5 pr-3 text-left font-normal">
                      {carga.nome}
                    </th>
                    <td className="py-1.5 pr-3">
                      <div
                        className="h-2.5 rounded bg-line-soft"
                        title={
                          carga.cargaMaxima != null
                            ? `${carga.nome}: ${carga.aulas} de ${carga.cargaMaxima} aulas (${largura}%)`
                            : `${carga.nome}: ${carga.aulas} aulas (sem carga máxima no cadastro)`
                        }
                      >
                        <div
                          className={cn('h-full rounded', acimaDoLimite ? 'bg-danger' : 'bg-primary')}
                          style={{ width: `${Math.min(largura, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                      <span className={cn(acimaDoLimite && 'font-semibold text-danger')}>{carga.aulas}</span>
                      {carga.cargaMaxima != null && <span className="text-muted"> de {carga.cargaMaxima}</span>}
                      {acimaDoLimite && <span className="block text-[11px] text-danger">acima do limite</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-muted">{carga.planejamentos}</td>
                    <td className="py-1.5 text-right text-muted">{carga.janelas}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <GenerationWarnings avisos={avisos} />
      </section>
    </div>
  )
}
