import { Link, useNavigate } from 'react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { deleteGrade, getHistoricoGrades, type GradeResumo } from '@/api/grades'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { paths } from '@/config/paths'
import { TabHeader } from '@/layouts/SectionLayout'
import { cn } from '@/lib/cn'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime, formatDuracao } from '@/lib/schedule'
import { useSchedule } from '@/schedule/useSchedule'
import { isEmAndamento, isFalha, STATUS_LABEL } from './generationShared'

/** Todas as gerações, da mais recente para a mais antiga; abrir uma a torna a grade exibida no sistema. */
export function GenerationHistoryPage() {
  const navigate = useNavigate()
  const { activeGrade, refreshSchedule } = useSchedule()
  const {
    data: historico = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<GradeResumo[]>({ queryKey: ['historicoGrades'], queryFn: () => getHistoricoGrades() })

  const concluidas = historico.filter((g) => g.status === 'sucesso').length
  const confirm = useConfirm()
  const toast = useToast()
  const [erro, setErro] = useState<string | null>(null)

  // Geração que não deu certo não tem grade para abrir; só sai do histórico
  const excluirFalha = async (g: GradeResumo) => {
    const ok = await confirm({
      title: `Excluir ${g.nome}?`,
      description: 'A geração sai do histórico. Nenhuma grade é apagada, porque esta não chegou a ser montada.',
      confirmLabel: 'Excluir',
      tone: 'danger',
    })
    if (!ok) return
    setErro(null)
    try {
      await deleteGrade(g.id)
      await refetch()
      toast(`${g.nome} saiu do histórico`)
    } catch (err) {
      setErro(getApiErrorMessage(err, 'Não foi possível excluir a geração.'))
    }
  }

  return (
    <>
      <TabHeader
        title="Histórico de gerações"
        description={
          historico.length
            ? `${historico.length} ${historico.length === 1 ? 'geração' : 'gerações'}, ${concluidas} com grade pronta. Abra uma para revisá-la.`
            : 'Cada geração fica registrada aqui, com o resultado e o tempo que levou.'
        }
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={buttonStyles({ variant: 'secondary', size: 'sm' })}
          >
            {isFetching ? 'Atualizando…' : 'Atualizar'}
          </button>
        }
      />

      {erro && (
        <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
          {erro}
        </p>
      )}
      <section className="card p-2 md:p-3" aria-label="Gerações">
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-paper" />
        ) : historico.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border-2 border-dashed border-line px-6 py-14 text-center">
            <p className="font-semibold">Nenhuma grade gerada ainda</p>
            <p className="mt-1 text-[13.5px] text-muted">
              As gerações aparecem aqui assim que você iniciar a primeira.
            </p>
            <Link to={paths.geracao} className={buttonStyles({ size: 'sm' }, 'mt-4')}>
              Gerar grade
            </Link>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead>
                <tr className="text-[12.5px] text-muted">
                  <th className="px-3 py-2.5 font-medium">Grade</th>
                  <th className="px-3 py-2.5 font-medium">Semestre</th>
                  <th className="px-3 py-2.5 text-right font-medium">Aulas</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tempo</th>
                  <th className="px-3 py-2.5 font-medium">Situação</th>
                  <th className="px-3 py-2.5 font-medium">Gerada em</th>
                  <th className="px-3 py-2.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {historico.map((g) => {
                  const exibida = g.id === activeGrade?.id
                  return (
                    <tr key={g.id} className={cn('border-t border-line-soft', exibida && 'bg-primary-soft/40')}>
                      <td className="px-3 py-3 font-semibold">
                        {g.nome}
                        {exibida && (
                          <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[11.5px] font-semibold text-white">
                            Em revisão
                          </span>
                        )}
                        {isFalha(g.status) && g.detalhes?.mensagem && (
                          <span className="mt-0.5 block max-w-md text-[12.5px] font-normal text-muted">
                            {g.detalhes.mensagem}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted">{g.ano_semestre ?? '—'}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{g.total_aulas}</td>
                      <td className="px-3 py-3 text-right text-muted tabular-nums">
                        {g.detalhes?.tempo_resolucao_seg != null ? formatDuracao(g.detalhes.tempo_resolucao_seg) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap',
                            g.status === 'sucesso' && 'bg-primary-soft text-primary',
                            isEmAndamento(g.status) && 'bg-warning-soft text-warning',
                            isFalha(g.status) && 'bg-danger-soft text-danger',
                          )}
                        >
                          {STATUS_LABEL[g.status] ?? g.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted tabular-nums">
                        {formatDateTime(g.criado_em)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {g.status === 'sucesso' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await refreshSchedule(g.id)
                              navigate(`${paths.grade}?gradeId=${g.id}`)
                            }}
                            className="rounded-full bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-ink-soft"
                          >
                            {exibida ? 'Revisar' : 'Abrir'}
                          </button>
                        )}
                        {isFalha(g.status) && (
                          <button
                            type="button"
                            onClick={() => excluirFalha(g)}
                            className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:bg-danger-soft hover:text-danger"
                          >
                            Excluir
                          </button>
                        )}
                        {isEmAndamento(g.status) && (
                          <Link to={paths.geracao} className="text-[13px] font-semibold hover:underline">
                            Acompanhar
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
