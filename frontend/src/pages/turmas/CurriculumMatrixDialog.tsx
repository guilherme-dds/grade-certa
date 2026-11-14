import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { nomesSemCadastro, type HorarioFixo, type ItemMatriz, type TurmaBackend } from '@/api/turmas'
import { MultiSelectChips } from '@/components/MultiSelectChips'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { RowMenu } from '@/components/ui/RowMenu'
import { Select } from '@/components/ui/Select'
import { Sheet, SheetBody, SheetFooter, useSheetClose } from '@/components/ui/Sheet'
import { cn } from '@/lib/cn'
import { fixoIndisponivel, useDisponibilidades } from '@/lib/fixosIndisponiveis'
import { capacidadeSemanal, horariosDaTurma, weekDays } from '@/lib/schedule'
import { useHorarios } from '@/schedule/useHorarios'

export interface TeacherWithSubjects {
  id: number
  name: string
  active: boolean
  subjects: string[]
}

// Valores do seletor de professores: o id do cadastro ou, para nomes sem cadastro, "nome:<nome>"
const PREFIXO_NOME = 'nome:'
const valoresDoItem = (item: ItemMatriz) => [
  ...(item.professor_ids ?? []).map(String),
  ...(item.professores ?? []).map((n) => PREFIXO_NOME + n),
]
const professoresDosValores = (valores: string[]) => ({
  professor_ids: valores.filter((v) => !v.startsWith(PREFIXO_NOME)).map(Number),
  professores: valores.filter((v) => v.startsWith(PREFIXO_NOME)).map((v) => v.slice(PREFIXO_NOME.length)),
})

const descricaoFixo = (f: HorarioFixo) => `${f.dia_semana}, ${f.horario ?? 'qualquer horário'}`
// Compara nomes de disciplina sem acento e sem caixa
const chave = (nome: string) => nome.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()

type Filtro = 'todas' | 'sem-professor' | 'fixas'

interface CurriculumMatrixDialogProps {
  turma: TurmaBackend
  availableSubjects: string[]
  teachers: TeacherWithSubjects[]
  /** Outras turmas, para copiar a matriz de uma delas */
  otherTurmas?: TurmaBackend[]
  onClose: () => void
  onSave: (matriz: ItemMatriz[]) => Promise<void>
}

const normalizarItem = (m: ItemMatriz): ItemMatriz => ({
  disciplina: m.disciplina,
  aulas_semanais: m.aulas_semanais,
  professor_ids: m.professor_ids ?? [],
  professores: nomesSemCadastro(m),
  horarios_fixos: m.horarios_fixos ?? [],
  extra: m.extra ?? false,
})

export function CurriculumMatrixDialog({
  turma,
  availableSubjects,
  teachers,
  otherTurmas = [],
  onClose,
  onSave,
}: CurriculumMatrixDialogProps) {
  const confirm = useConfirm()
  // Cada item guarda os ids dos professores cadastrados e os nomes ainda sem cadastro
  const [initial] = useState<ItemMatriz[]>(() => (turma.matriz_curricular ?? []).map(normalizarItem))
  const [items, setItems] = useState(initial)
  const dirty = JSON.stringify(items) !== JSON.stringify(initial)

  const activeTeachers = teachers.filter((t) => t.active)
  /** Professores ativos com a disciplina no cadastro */
  const aptosPara = (disciplina: string) =>
    activeTeachers.filter((t) => t.subjects.some((s) => chave(s) === chave(disciplina)))

  // Seletor de professores: quem tem a disciplina no cadastro vem primeiro;
  // inativos e nomes sem cadastro só aparecem se já estão na matriz
  const emUso = new Set(items.flatMap(valoresDoItem))
  const opcoesProfessores = (disciplina: string) => {
    const aptos = new Set(aptosPara(disciplina).map((t) => t.id))
    const grupoAptos = `Têm ${disciplina} no cadastro`
    const cadastrados = teachers
      .filter((t) => t.active || emUso.has(String(t.id)))
      .map((t) => ({
        value: String(t.id),
        label: t.active ? t.name : `${t.name} (inativo)`,
        group: aptos.has(t.id) ? grupoAptos : 'Outros professores',
      }))
    return [
      ...cadastrados.filter((o) => o.group === grupoAptos),
      ...cadastrados.filter((o) => o.group !== grupoAptos),
      ...[...emUso]
        .filter((v) => v.startsWith(PREFIXO_NOME))
        .map((v) => ({ value: v, label: `${v.slice(PREFIXO_NOME.length)} (não cadastrado)`, group: 'Sem cadastro' })),
    ]
  }

  const horariosQuery = useHorarios()
  const turmaSlots = horariosQuery.data ? horariosDaTurma(turma, horariosQuery.data) : []
  const capacidade = horariosQuery.data ? capacidadeSemanal(turma, horariosQuery.data) : null

  // Linha com o painel de dias/horários fixos aberto
  const [expanded, setExpanded] = useState<number | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')

  // Disponibilidade de quem tem aula fixada (ou está fixando agora), para avisar de horário bloqueado
  const disponibilidades = useDisponibilidades(
    items.flatMap((i, idx) => ((i.horarios_fixos?.length ?? 0) > 0 || idx === expanded ? (i.professor_ids ?? []) : [])),
  )
  const nomeProfessor = (id: number) => teachers.find((t) => t.id === id)?.name ?? 'Professor'
  /** Quem do item marcou este dia/horário como indisponível */
  const indisponiveisNo = (item: ItemMatriz, fixo: HorarioFixo) =>
    (item.professor_ids ?? [])
      .filter((id) => fixoIndisponivel(fixo, turmaSlots, disponibilidades.get(id) ?? []))
      .map(nomeProfessor)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Leva a linha recém-adicionada para a vista
  const listEndRef = useRef<HTMLDivElement>(null)
  const scrollToEnd = useRef(false)
  useEffect(() => {
    if (!scrollToEnd.current) return
    scrollToEnd.current = false
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [items.length])

  const updateItem = (index: number, changes: Partial<ItemMatriz>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...changes } : item)))
    setError('')
  }

  // Disciplina nova: se só um professor ativo tem a disciplina no cadastro, ele já entra
  const handleAddItem = (disciplina: string, aulas: number) => {
    const aptos = aptosPara(disciplina)
    scrollToEnd.current = true
    setFiltro('todas')
    setItems((prev) => [
      ...prev,
      {
        disciplina,
        aulas_semanais: aulas,
        professor_ids: aptos.length === 1 ? [aptos[0].id] : [],
        professores: [],
        horarios_fixos: [],
        extra: false,
      },
    ])
    setError('')
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
    setExpanded(null)
  }

  const copiarDe = async (origem: TurmaBackend) => {
    const matriz = (origem.matriz_curricular ?? []).map(normalizarItem)
    if (items.length > 0) {
      const ok = await confirm({
        title: `Substituir pela matriz da turma ${origem.nome}?`,
        description: `As ${items.length} disciplinas atuais saem e entram as ${matriz.length} da turma ${origem.nome}, com aulas, professores e horários fixos. Nada é salvo até você clicar em Salvar matriz.`,
        confirmLabel: 'Substituir',
        tone: 'danger',
      })
      if (!ok) return
    }
    setItems(matriz)
    setExpanded(null)
    setFiltro('todas')
    setError('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      setError('Adicione pelo menos uma disciplina à matriz.')
      return
    }
    const excedente = items.find((i) => (i.horarios_fixos?.length ?? 0) > i.aulas_semanais)
    if (excedente) {
      setError(`${excedente.disciplina} tem mais dias ou horários fixos que aulas na semana.`)
      return
    }
    try {
      setIsSubmitting(true)
      await onSave(items)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Não foi possível salvar a matriz. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Aulas extras (ex.: laboratório) ocupam a grade, mas ficam fora do total da matriz
  const sumAulas = (list: ItemMatriz[]) => list.reduce((acc, curr) => acc + (Number(curr.aulas_semanais) || 0), 0)
  const totalHours = sumAulas(items.filter((i) => !i.extra))
  const extraHours = sumAulas(items.filter((i) => i.extra))
  const semProfessor = items.filter((i) => valoresDoItem(i).length === 0).length
  const comFixo = items.filter((i) => (i.horarios_fixos?.length ?? 0) > 0).length
  const contagem = new Map<string, number>()
  for (const i of items) contagem.set(chave(i.disciplina), (contagem.get(chave(i.disciplina)) ?? 0) + 1)
  const disciplinasOrdenadas = [...availableSubjects].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const copiaveis = otherTurmas.filter((t) => t.id !== turma.id && (t.matriz_curricular?.length ?? 0) > 0)

  const visiveis = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) =>
      filtro === 'sem-professor'
        ? valoresDoItem(item).length === 0
        : filtro === 'fixas'
          ? (item.horarios_fixos?.length ?? 0) > 0
          : true,
    )

  return (
    <Sheet
      width="xl"
      dirty={dirty}
      onClose={onClose}
      title={`Matriz curricular · ${turma.nome}`}
      description={`${turma.nivel_ensino ? `${turma.nivel_ensino}, turno` : 'Turno'} ${turma.turno.toLowerCase()}. Quem dá cada disciplina nesta turma e quantas aulas ela tem por semana.`}
    >
      <form onSubmit={handleSubmit} className="contents">
        <SheetBody className="px-4 pt-0 sm:px-6">
          {/* Resumo fixo no topo: aulas contra os horários da turma e atalhos para o que falta */}
          <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-line-soft bg-white/95 px-4 pt-4 pb-3 backdrop-blur sm:-mx-6 sm:px-6">
            <CapacityMeter aulas={totalHours} extras={extraHours} capacidade={capacidade} />
            {items.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <FilterChip active={filtro === 'todas'} onClick={() => setFiltro('todas')}>
                  Todas <Count>{items.length}</Count>
                </FilterChip>
                <FilterChip
                  active={filtro === 'sem-professor'}
                  onClick={() => setFiltro('sem-professor')}
                  disabled={semProfessor === 0}
                  attention={semProfessor > 0}
                >
                  Sem professor <Count>{semProfessor}</Count>
                </FilterChip>
                <FilterChip active={filtro === 'fixas'} onClick={() => setFiltro('fixas')} disabled={comFixo === 0}>
                  Com dia ou horário fixo <Count>{comFixo}</Count>
                </FilterChip>
                {copiaveis.length > 0 && <CopyFrom turmas={copiaveis} onPick={copiarDe} className="ml-auto" />}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="rounded-[20px] border-2 border-dashed border-line px-6 py-10 text-center">
              <p className="font-semibold">A matriz está vazia</p>
              <p className="mx-auto mt-1 max-w-md text-[14px] text-muted">
                Adicione cada disciplina da turma com o número de aulas por semana
                {copiaveis.length > 0 ? ', ou comece pela matriz de outra turma parecida.' : '.'}
              </p>
              {copiaveis.length > 0 && (
                <CopyFrom turmas={copiaveis} onPick={copiarDe} className="mt-4 justify-center" />
              )}
            </div>
          ) : visiveis.length === 0 ? (
            <p className="rounded-2xl bg-paper px-4 py-6 text-center text-[14px] text-muted">
              Nenhuma disciplina neste filtro.
            </p>
          ) : (
            <>
              <div
                aria-hidden
                className="mb-2 hidden grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_128px_36px] gap-3 px-3 text-[12.5px] font-medium text-muted lg:grid"
              >
                <span>Disciplina</span>
                <span>Professores</span>
                <span>Aulas por semana</span>
                <span />
              </div>

              <ol className="divide-y divide-line-soft rounded-2xl border border-line-soft">
                {visiveis.map(({ item, idx }) => {
                  const professores = valoresDoItem(item)
                  const aptos = aptosPara(item.disciplina)
                  const foraDoCadastro = (item.professor_ids ?? [])
                    .map((id) => teachers.find((t) => t.id === id))
                    .filter((t): t is TeacherWithSubjects => Boolean(t))
                    .filter((t) => !t.subjects.some((s) => chave(s) === chave(item.disciplina)))
                  const repetida = (contagem.get(chave(item.disciplina)) ?? 0) > 1
                  const fixos = item.horarios_fixos ?? []
                  const isOpen = expanded === idx
                  const bloqueios = fixos.flatMap((f) =>
                    indisponiveisNo(item, f).map((nome) => `${nome} marcou ${descricaoFixo(f)} como indisponível`),
                  )
                  const opcoesDisciplina = disciplinasOrdenadas.includes(item.disciplina)
                    ? disciplinasOrdenadas
                    : [item.disciplina, ...disciplinasOrdenadas]
                  const temAvisos =
                    professores.length === 0 ||
                    foraDoCadastro.length > 0 ||
                    repetida ||
                    item.extra ||
                    fixos.length > 0 ||
                    bloqueios.length > 0

                  return (
                    <li
                      key={idx}
                      className={cn(
                        'px-3 py-2.5 transition-colors first:rounded-t-2xl last:rounded-b-2xl',
                        isOpen ? 'bg-paper/60' : 'hover:bg-paper/40',
                      )}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_128px_36px] lg:items-center">
                        <Select
                          label="Disciplina"
                          variant="ghost"
                          value={item.disciplina}
                          onChange={(v) => updateItem(idx, { disciplina: v })}
                          options={opcoesDisciplina.map((sub) => ({ value: sub, label: sub }))}
                          menuMinWidth={240}
                        />

                        <div className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:row-start-auto">
                          <MultiSelectChips
                            options={opcoesProfessores(item.disciplina)}
                            value={professores}
                            onChange={(value) => updateItem(idx, professoresDosValores(value))}
                            addLabel={professores.length ? '+ professor' : 'Escolher professor'}
                          />
                        </div>

                        <Stepper
                          value={item.aulas_semanais}
                          onChange={(n) => updateItem(idx, { aulas_semanais: n })}
                          label={`Aulas por semana de ${item.disciplina}`}
                        />

                        <div className="col-start-2 row-start-1 justify-self-end lg:col-start-auto lg:row-start-auto">
                          <RowMenu
                            label={`Mais opções para ${item.disciplina}`}
                            items={[
                              {
                                label: isOpen ? 'Fechar dias e horários fixos' : 'Fixar dia ou horário',
                                onSelect: () => setExpanded(isOpen ? null : idx),
                              },
                              {
                                label: item.extra ? 'Contar no total da matriz' : 'Marcar como aula extra',
                                onSelect: () => updateItem(idx, { extra: !item.extra }),
                              },
                              { label: 'Remover da matriz', danger: true, onSelect: () => handleRemoveItem(idx) },
                            ]}
                          />
                        </div>
                      </div>

                      {temAvisos && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 px-2 text-[12.5px]">
                          {professores.length === 0 && (
                            <>
                              <span className="rounded-full bg-warning-soft px-2.5 py-0.5 font-semibold text-warning">
                                Sem professor: fica fora da grade
                              </span>
                              {aptos.slice(0, 3).map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => updateItem(idx, { professor_ids: [t.id] })}
                                  className="rounded-full border border-line px-2.5 py-0.5 font-semibold hover:border-ink hover:bg-white"
                                >
                                  + {t.name}
                                </button>
                              ))}
                              {aptos.length === 0 && (
                                <span className="text-muted">
                                  Nenhum professor ativo tem {item.disciplina} no cadastro.
                                </span>
                              )}
                            </>
                          )}
                          {foraDoCadastro.map((t) => (
                            <span key={t.id} className="rounded-full bg-paper px-2.5 py-0.5 text-muted">
                              {t.name} não tem {item.disciplina} no cadastro
                            </span>
                          ))}
                          {bloqueios.map((texto) => (
                            <span
                              key={texto}
                              className="rounded-full bg-danger-soft px-2.5 py-0.5 font-semibold text-danger"
                            >
                              {texto}
                            </span>
                          ))}
                          {repetida && (
                            <span className="rounded-full bg-paper px-2.5 py-0.5 text-muted">
                              {item.disciplina} está em {contagem.get(chave(item.disciplina))} linhas
                            </span>
                          )}
                          {item.extra && (
                            <span className="rounded-full bg-lilac-soft px-2.5 py-0.5 font-medium">
                              Aula extra, fora do total
                            </span>
                          )}
                          {fixos.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpanded(isOpen ? null : idx)}
                              className="rounded-full bg-paper px-2.5 py-0.5 font-medium hover:bg-line-soft"
                            >
                              Fixo: {fixos.map(descricaoFixo).join('; ')}
                            </button>
                          )}
                        </div>
                      )}

                      {isOpen && (
                        <FixedSlotsEditor
                          item={item}
                          slots={turmaSlots}
                          indisponiveis={(fixo) => indisponiveisNo(item, fixo)}
                          onChange={(changes) => updateItem(idx, changes)}
                        />
                      )}
                    </li>
                  )
                })}
              </ol>
            </>
          )}

          <AddSubject
            options={disciplinasOrdenadas.filter((s) => !contagem.has(chave(s)))}
            aptosPara={aptosPara}
            onAdd={handleAddItem}
            first={items.length === 0}
          />
          <div ref={listEndRef} />
        </SheetBody>

        <SheetFooter
          start={
            error ? (
              <span role="alert" className="font-medium text-danger">
                {error}
              </span>
            ) : (
              <>
                {items.length} {items.length === 1 ? 'disciplina' : 'disciplinas'}
                {semProfessor > 0 && <span className="font-semibold text-warning">, {semProfessor} sem professor</span>}
              </>
            )
          }
        >
          <CancelButton disabled={isSubmitting} />
          <Button type="submit" disabled={isSubmitting || !dirty}>
            {isSubmitting ? 'Salvando…' : 'Salvar matriz'}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  )
}

/** Aulas da matriz contra os horários que a turma tem na semana */
function CapacityMeter({ aulas, extras, capacidade }: { aulas: number; extras: number; capacidade: number | null }) {
  const ocupadas = aulas + extras
  const pct = capacidade ? Math.min(100, (ocupadas / capacidade) * 100) : 0
  const passou = capacidade != null && ocupadas > capacidade
  const livres = capacidade != null ? capacidade - ocupadas : null
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[14px] text-muted">
          <span
            className={cn(
              'font-display text-[26px] leading-none font-bold text-ink tabular-nums',
              passou && 'text-danger',
            )}
          >
            {aulas}
          </span>{' '}
          {aulas === 1 ? 'aula' : 'aulas'} por semana
          {extras > 0 && ` + ${extras} extra`}
          {capacidade != null && <span className="tabular-nums">, a turma tem {capacidade} horários</span>}
        </p>
        {livres != null && (
          <p
            className={cn(
              'text-[13px] font-semibold',
              passou ? 'text-danger' : livres === 0 ? 'text-primary' : 'text-muted',
            )}
          >
            {passou
              ? `${-livres} ${-livres === 1 ? 'aula' : 'aulas'} a mais do que cabe`
              : livres === 0
                ? 'Todos os horários preenchidos'
                : `${livres} ${livres === 1 ? 'horário vago' : 'horários vagos'}`}
          </p>
        )}
      </div>
      {capacidade != null ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line-soft" aria-hidden="true">
          <div
            className={cn('h-full rounded-full transition-[width] duration-300', passou ? 'bg-danger' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <p className="mt-1 text-[12.5px] text-muted">
          O gerador escolhe as tardes desta turma; para ver quantos horários ela tem, defina os dias de tarde no
          cadastro da turma.
        </p>
      )}
    </div>
  )
}

function FilterChip({
  active,
  attention,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  attention?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled && !active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-45',
        active
          ? 'bg-ink text-white'
          : attention
            ? 'bg-warning-soft text-warning hover:bg-warning-soft/70'
            : 'bg-paper text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

const Count = ({ children }: { children: ReactNode }) => (
  <span className="text-[12px] font-semibold tabular-nums opacity-80">{children}</span>
)

/** Copia a matriz de outra turma: disciplinas, aulas, professores e horários fixos */
function CopyFrom({
  turmas,
  onPick,
  className,
}: {
  turmas: TurmaBackend[]
  onPick: (turma: TurmaBackend) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2 text-[13px]', className)}>
      <span className="text-muted">Copiar de</span>
      <Select
        label="Copiar matriz de outra turma"
        placeholder="outra turma…"
        size="sm"
        value=""
        onChange={(v) => {
          const t = turmas.find((x) => String(x.id) === v)
          if (t) onPick(t)
        }}
        options={turmas.map((t) => ({
          value: String(t.id),
          label: t.nome,
          hint: `${t.matriz_curricular?.length ?? 0} disciplinas`,
        }))}
        menuMinWidth={260}
      />
    </div>
  )
}

/** Inclui uma disciplina que ainda não está na matriz */
function AddSubject({
  options,
  aptosPara,
  onAdd,
  first,
}: {
  options: string[]
  aptosPara: (disciplina: string) => TeacherWithSubjects[]
  onAdd: (disciplina: string, aulas: number) => void
  first: boolean
}) {
  const [disciplina, setDisciplina] = useState('')
  const [aulas, setAulas] = useState(2)
  const aptos = disciplina ? aptosPara(disciplina) : []

  if (options.length === 0) {
    return (
      <p className="mt-3 rounded-2xl bg-paper px-4 py-3 text-[13px] text-muted">
        Todas as disciplinas cadastradas já estão na matriz. Para incluir outra, cadastre-a em Disciplinas.
      </p>
    )
  }

  return (
    <div className="mt-3 rounded-2xl border-2 border-dashed border-line p-3">
      <p className="mb-2 px-1 text-[13px] font-semibold">
        {first ? 'Adicionar a primeira disciplina' : 'Adicionar disciplina'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          label="Disciplina a adicionar"
          placeholder="Escolha a disciplina"
          variant="field"
          size="sm"
          value={disciplina}
          onChange={setDisciplina}
          options={options.map((d) => ({ value: d, label: d }))}
          className="min-w-0 flex-1 basis-56"
        />
        <Stepper value={aulas} onChange={setAulas} label="Aulas por semana da nova disciplina" />
        <Button
          variant="dark"
          disabled={!disciplina}
          onClick={() => {
            onAdd(disciplina, aulas)
            setDisciplina('')
            setAulas(2)
          }}
        >
          Adicionar
        </Button>
      </div>
      {disciplina && (
        <p className="mt-2 px-1 text-[12.5px] text-muted">
          {aptos.length === 1
            ? `${aptos[0].name} é o único com ${disciplina} no cadastro e já entra como professor.`
            : aptos.length > 1
              ? `${aptos.length} professores têm ${disciplina} no cadastro; escolha quem dá a aula depois de adicionar.`
              : `Nenhum professor ativo tem ${disciplina} no cadastro.`}
        </p>
      )}
    </div>
  )
}

function CancelButton({ disabled }: { disabled?: boolean }) {
  const close = useSheetClose()
  return (
    <Button variant="secondary" onClick={close} disabled={disabled}>
      Cancelar
    </Button>
  )
}

/** − n + para o número de aulas por semana */
function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const set = (n: number) => onChange(Math.min(30, Math.max(1, n || 1)))
  const btn =
    'grid size-8 place-items-center rounded-full text-[17px] leading-none text-ink transition-colors hover:bg-white disabled:opacity-30'
  return (
    <div
      role="group"
      aria-label={label}
      className="flex h-10 w-[128px] items-center justify-between rounded-full bg-paper px-1"
    >
      <button
        type="button"
        className={btn}
        onClick={() => set(value - 1)}
        disabled={value <= 1}
        aria-label="Menos uma aula"
      >
        −
      </button>
      <input
        type="number"
        min={1}
        max={30}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={label}
        className="w-10 [appearance:textfield] bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        className={btn}
        onClick={() => set(value + 1)}
        disabled={value >= 30}
        aria-label="Mais uma aula"
      >
        +
      </button>
    </div>
  )
}

// Valor do seletor para fixar só o dia (o gerador escolhe o horário)
const QUALQUER_HORARIO = ''

/** Dias/horários definidos pela escola para um item; as demais aulas o gerador distribui. */
function FixedSlotsEditor({
  item,
  slots,
  indisponiveis,
  onChange,
}: {
  item: ItemMatriz
  /** Horários de aula da turma */
  slots: string[]
  /** Professores do item que marcaram este dia/horário como indisponível */
  indisponiveis: (fixo: HorarioFixo) => string[]
  onChange: (changes: Partial<ItemMatriz>) => void
}) {
  const fixos = item.horarios_fixos ?? []
  const [dia, setDia] = useState<string>(weekDays[0])
  const [horario, setHorario] = useState(QUALQUER_HORARIO)
  // Um mesmo dia+horário só pode ser fixado uma vez; "qualquer horário" pode repetir (2 aulas na terça)
  const jaFixado = horario !== QUALQUER_HORARIO && fixos.some((f) => f.dia_semana === dia && f.horario === horario)
  const restantes = item.aulas_semanais - fixos.length
  const bloqueadoPara = indisponiveis({ dia_semana: dia, horario: horario || null })
  const bloqueioDoHorario = (h: string) => indisponiveis({ dia_semana: dia, horario: h })

  const fixar = () => onChange({ horarios_fixos: [...fixos, { dia_semana: dia, horario: horario || null }] })
  const remover = (indice: number) => onChange({ horarios_fixos: fixos.filter((_, i) => i !== indice) })

  return (
    <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-line-soft">
      <p className="text-[13px] text-muted">
        Fixe as aulas que precisam cair num dia ou horário certo. Com “qualquer horário”, o gerador escolhe o horário
        dentro do dia.
        {fixos.length > 0 &&
          restantes > 0 &&
          (restantes === 1 ? ' A outra aula o gerador distribui.' : ` As outras ${restantes} o gerador distribui.`)}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {fixos.map((f, i) => (
          <span
            key={`${f.dia_semana}-${f.horario ?? 'dia'}-${i}`}
            className="inline-flex h-9 items-center gap-1 rounded-full bg-white py-0.5 pr-1 pl-3 text-[13px] font-medium shadow-xs"
          >
            {descricaoFixo(f)}
            <button
              type="button"
              onClick={() => remover(i)}
              aria-label={`Remover ${descricaoFixo(f)}`}
              className="grid size-7 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
            >
              ×
            </button>
          </span>
        ))}
        {restantes > 0 ? (
          <>
            <Select
              label="Dia"
              size="sm"
              value={dia}
              onChange={setDia}
              options={weekDays.map((d) => ({ value: d, label: d }))}
            />
            <Select
              label="Horário"
              size="sm"
              menuMinWidth={250}
              value={horario}
              onChange={setHorario}
              options={[
                { value: QUALQUER_HORARIO, label: 'qualquer horário' },
                ...slots.map((h) => ({
                  value: h,
                  label: h,
                  hint: bloqueioDoHorario(h).length ? 'indisponível' : undefined,
                })),
              ]}
            />
            <Button variant="dark" size="sm" onClick={fixar} disabled={jaFixado}>
              Fixar
            </Button>
          </>
        ) : (
          <span className="text-[13px] text-muted">Todas as aulas já têm dia ou horário fixo.</span>
        )}
      </div>
      {restantes > 0 && !jaFixado && bloqueadoPara.length > 0 && (
        <p className="mt-2 text-[12.5px] font-medium text-danger" role="status">
          {bloqueadoPara.join(' e ')} {bloqueadoPara.length > 1 ? 'marcaram' : 'marcou'}{' '}
          {horario ? `${dia}, ${horario}` : `${dia} (o dia todo)`} como indisponível. Com esse fixo, a grade não fecha.
        </p>
      )}
    </div>
  )
}
