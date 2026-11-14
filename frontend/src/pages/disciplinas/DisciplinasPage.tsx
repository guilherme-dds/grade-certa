import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDisciplina, deleteDisciplina, getDisciplinas } from '@/api/disciplinas'
import { getProfessores } from '@/api/professores'
import { getTurmas } from '@/api/turmas'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { RowMenu } from '@/components/ui/RowMenu'
import { useToast } from '@/components/ui/Toast'
import { QuickFilters, SearchInput, Toolbar } from '@/components/ui/FilterBar'
import { paths } from '@/config/paths'
import { getApiErrorMessage } from '@/lib/apiError'
import { TabHeader } from '@/layouts/SectionLayout'
import { atribuirProfessor, descreverVagas, vagasParaProfessor } from '@/lib/matrizVagas'
import { SubjectDialog } from '@/pages/teachers/SubjectDialog'

interface DisciplinaRow {
  id?: number
  nome: string
  professores: string[]
  professorIds: number[]
  turmas: { id: number; nome: string }[]
  aulasSemana: number
  /** Turmas em que a disciplina está na matriz sem nenhum professor */
  turmasSemProfessor: { id: number; nome: string }[]
}

export function DisciplinasPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [filter, setFilter] = useState('todas')
  const [search, setSearch] = useState('')
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const disciplinasQuery = useQuery({ queryKey: ['disciplinas'], queryFn: () => getDisciplinas() })
  const professoresQuery = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() })
  const turmasQuery = useQuery({ queryKey: ['turmas'], queryFn: getTurmas })

  const createMutation = useMutation({
    mutationFn: (nome: string) => createDisciplina({ nome }),
    onSuccess: (d) => {
      toast(`${d.nome} cadastrada`)
      return queryClient.invalidateQueries({ queryKey: ['disciplinas'] })
    },
  })

  const rows = useMemo<DisciplinaRow[]>(() => {
    const ativos = (professoresQuery.data ?? []).filter((p) => p.ativo)
    return (disciplinasQuery.data ?? [])
      .map((d) => {
        const aptos = ativos.filter((p) => d.id != null && p.disciplinas?.includes(d.id))
        const chave = d.nome.trim().toLowerCase()
        const turmas: DisciplinaRow['turmas'] = []
        const turmasSemProfessor: DisciplinaRow['turmasSemProfessor'] = []
        let aulasSemana = 0
        for (const t of turmasQuery.data ?? []) {
          for (const item of t.matriz_curricular ?? []) {
            if (item.disciplina.trim().toLowerCase() !== chave || !(Number(item.aulas_semanais) > 0)) continue
            aulasSemana += Number(item.aulas_semanais)
            if (t.id && !turmas.some((x) => x.id === t.id)) turmas.push({ id: t.id, nome: t.nome })
            if (t.id && !item.professor_ids?.length && !item.professores?.length)
              turmasSemProfessor.push({ id: t.id, nome: t.nome })
          }
        }
        return {
          id: d.id,
          nome: d.nome,
          professores: aptos.map((p) => p.nome),
          professorIds: aptos.flatMap((p) => (p.id != null ? [p.id] : [])),
          turmas,
          aulasSemana,
          turmasSemProfessor,
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [disciplinasQuery.data, professoresQuery.data, turmasQuery.data])

  const atribuir = async (r: DisciplinaRow) => {
    const vagas = vagasParaProfessor(turmasQuery.data ?? [], [r.nome])
    if (vagas.length === 0) return
    const ok = await confirm({
      title: `Atribuir ${r.professores[0]}?`,
      description: `${r.professores[0]} passa a dar ${descreverVagas(vagas)}, na matriz curricular.`,
      confirmLabel: 'Atribuir',
    })
    if (!ok) return
    await atribuirProfessor(vagas, r.professorIds[0])
    await queryClient.invalidateQueries({ queryKey: ['turmas'] })
  }

  // Só sai disciplina que não está em nenhuma matriz; o cadastro dos professores é limpo junto
  const excluir = async (r: DisciplinaRow) => {
    if (r.id == null) return
    const ok = await confirm({
      title: `Excluir ${r.nome}?`,
      description: r.professores.length
        ? `${r.nome} também sai do cadastro de ${r.professores.join(', ')}. Não dá para desfazer.`
        : 'Não dá para desfazer.',
      confirmLabel: 'Excluir',
      tone: 'danger',
    })
    if (!ok) return
    setErroExclusao(null)
    try {
      await deleteDisciplina(r.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['disciplinas'] }),
        queryClient.invalidateQueries({ queryKey: ['professores'] }),
      ])
      toast(`${r.nome} excluída`)
    } catch (err) {
      setErroExclusao(getApiErrorMessage(err, `Não foi possível excluir ${r.nome}.`))
    }
  }

  const semProfessor = (r: DisciplinaRow) =>
    r.turmas.length > 0 && (r.professores.length === 0 || r.turmasSemProfessor.length > 0)
  const foraDasMatrizes = (r: DisciplinaRow) => r.turmas.length === 0

  const termo = search.trim().toLowerCase()
  const visible = rows.filter(
    (r) =>
      (filter === 'sem professor' ? semProfessor(r) : filter === 'fora das matrizes' ? foraDasMatrizes(r) : true) &&
      (!termo || r.nome.toLowerCase().includes(termo) || r.professores.some((p) => p.toLowerCase().includes(termo))),
  )

  const isLoading = disciplinasQuery.isLoading || professoresQuery.isLoading || turmasQuery.isLoading

  return (
    <>
      <TabHeader
        title="Disciplinas"
        description="Quem pode dar cada disciplina e em quais turmas ela está na matriz. Disciplina sem professor fica sem aula na grade."
        actions={<Button onClick={() => setIsDialogOpen(true)}>Nova disciplina</Button>}
      />

      <QuickFilters
        label="Mostrar disciplinas"
        value={filter}
        onChange={setFilter}
        filters={[
          { value: 'todas', label: 'Todas', count: rows.length },
          { value: 'sem professor', label: 'Sem professor', count: rows.filter(semProfessor).length, attention: true },
          { value: 'fora das matrizes', label: 'Fora das matrizes', count: rows.filter(foraDasMatrizes).length },
        ]}
      />
      <div className="mt-3">
        <Toolbar>
          <SearchInput
            label="Buscar disciplina"
            placeholder="Buscar por disciplina ou professor"
            value={search}
            onChange={setSearch}
          />
        </Toolbar>
      </div>

      {erroExclusao && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
          {erroExclusao}
        </p>
      )}

      {isLoading ? (
        <p className="my-6 text-center text-sm text-muted">Carregando disciplinas…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-line bg-white/60 p-10 text-center">
          <p className="font-semibold">
            {rows.length ? 'Nenhuma disciplina com esses filtros' : 'Nenhuma disciplina cadastrada'}
          </p>
          {!rows.length && (
            <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
              Cadastrar primeira disciplina
            </Button>
          )}
        </div>
      ) : (
        <DataTable
          caption="Disciplinas"
          rows={visible}
          rowKey={(r) => r.nome}
          columns={[
            { header: 'Disciplina', cell: (r) => <span className="font-semibold">{r.nome}</span> },
            {
              header: 'Professores',
              cell: (r) =>
                r.professores.length ? (
                  <span className="text-[13.5px]" title={r.professores.join(', ')}>
                    {r.professores.slice(0, 3).join(', ')}
                    {r.professores.length > 3 && <span className="text-muted"> +{r.professores.length - 3}</span>}
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-warning-soft px-2.5 py-1 text-[12.5px] font-semibold text-warning">
                    Nenhum professor
                  </span>
                ),
            },
            {
              header: 'Turmas',
              cell: (r) =>
                r.turmas.length ? (
                  <span className="text-[13.5px]" title={r.turmas.map((t) => t.nome).join(', ')}>
                    <span className="font-semibold tabular-nums">{r.turmas.length}</span>
                    <span className="text-muted">
                      {' '}
                      · {r.aulasSemana} {r.aulasSemana === 1 ? 'aula' : 'aulas'}/semana
                    </span>
                  </span>
                ) : (
                  <span className="text-[13.5px] text-muted">Fora das matrizes</span>
                ),
            },
            {
              header: 'Sem professor na matriz',
              cell: (r) =>
                r.turmasSemProfessor.length ? (
                  <span className="flex flex-wrap items-center gap-1">
                    {r.turmasSemProfessor.map((t) => (
                      <Link
                        key={t.id}
                        to={paths.matrizDaTurma(t.id)}
                        className="rounded-full bg-danger-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-danger hover:underline"
                      >
                        {t.nome}
                      </Link>
                    ))}
                    {/* Com um só professor apto, a escolha é óbvia: preenche direto */}
                    {r.professorIds.length === 1 && (
                      <button
                        type="button"
                        onClick={() => atribuir(r)}
                        className="ml-1 rounded-full bg-ink px-3 py-1 text-[12.5px] font-semibold text-white hover:bg-ink-soft"
                      >
                        Atribuir {r.professores[0]}
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="text-[13.5px] text-muted">—</span>
                ),
            },
            {
              header: 'Ações',
              className: 'w-px',
              cell: (r) =>
                foraDasMatrizes(r) ? (
                  <RowMenu
                    label={`Mais ações para ${r.nome}`}
                    items={[{ label: 'Excluir disciplina', danger: true, onSelect: () => excluir(r) }]}
                  />
                ) : null,
            },
          ]}
        />
      )}

      {isDialogOpen && (
        <SubjectDialog
          availableSubjects={rows.map((r) => r.nome)}
          onAddSubject={(nome) => createMutation.mutate(nome.trim())}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </>
  )
}
