import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { Jornada } from '@/api/configuracoes'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/Button'
import { Sheet, SheetBody, SheetFooter, useSheetClose } from '@/components/ui/Sheet'
import { cn } from '@/lib/cn'
import { resumoJornada, validarJornada, type JornadaErrors } from './jornada'
import { JornadaFields } from './JornadaFields'
import { type NivelEnsino, type Teacher } from './types'

const allNiveis: NivelEnsino[] = ['Anos Iniciais', 'Anos Finais', 'Ensino Médio']

interface TeacherDialogProps {
  teacher?: Teacher | null
  availableSubjects: string[]
  jornadaPadrao: Jornada
  onAddSubject: (subjectName: string) => void
  onClose: () => void
  onSave: (teacherData: Omit<Teacher, 'id' | 'currentWeeklyHours'> & { id?: string }) => void
}

export function TeacherDialog({
  teacher,
  availableSubjects,
  jornadaPadrao,
  onAddSubject,
  onClose,
  onSave,
}: TeacherDialogProps) {
  const isEditing = Boolean(teacher)

  const [name, setName] = useState(teacher?.name ?? '')
  const [email, setEmail] = useState(teacher?.email ?? '')
  const [selectedNiveis, setSelectedNiveis] = useState<NivelEnsino[]>(teacher?.niveisEnsino ?? ['Anos Finais'])
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(teacher?.maxWeeklyHours ?? 20)
  const [status, setStatus] = useState<'ativo' | 'inativo'>(teacher?.status ?? 'ativo')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(teacher?.subjects ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [jornadaPersonalizada, setJornadaPersonalizada] = useState(Boolean(teacher?.jornada))
  const [jornada, setJornada] = useState<Jornada>(teacher?.jornada ?? jornadaPadrao)
  const [jornadaErrors, setJornadaErrors] = useState<JornadaErrors>({})
  const [touched, setTouched] = useState(false)

  const clearError = (key: string) => errors[key] && setErrors((prev) => ({ ...prev, [key]: '' }))
  const touch = () => setTouched(true)

  const toggleNivel = (nivel: NivelEnsino) => {
    touch()
    setSelectedNiveis((prev) =>
      prev.includes(nivel) ? (prev.length > 1 ? prev.filter((n) => n !== nivel) : prev) : [...prev, nivel],
    )
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Informe o nome.'
    // E-mail é só contato (opcional): professores não acessam o sistema
    if (email.trim() && !email.includes('@')) newErrors.email = 'Informe um e-mail válido.'
    if (selectedSubjects.length === 0) newErrors.subjects = 'Escolha pelo menos uma disciplina.'
    if (maxWeeklyHours < 1 || maxWeeklyHours > 60) newErrors.maxWeeklyHours = 'Entre 1 e 60 horas.'

    const errosJornada = jornadaPersonalizada ? validarJornada(jornada) : {}
    setJornadaErrors(errosJornada)
    if (Object.keys(newErrors).length > 0 || Object.keys(errosJornada).length > 0) {
      setErrors(newErrors)
      return
    }

    onSave({
      id: teacher?.id,
      name: name.trim(),
      email: email.trim(),
      niveisEnsino: selectedNiveis,
      subjects: selectedSubjects,
      maxWeeklyHours: Number(maxWeeklyHours),
      status,
      jornada: jornadaPersonalizada ? jornada : null,
    })
    onClose()
  }

  return (
    <Sheet
      width="md"
      dirty={touched}
      onClose={onClose}
      title={isEditing ? `Editar ${teacher?.name}` : 'Novo professor'}
      description="O que o gerador precisa saber: o que a pessoa ensina, em quais níveis e quanto pode trabalhar."
    >
      <form
        onSubmit={handleSubmit}
        onChange={(e) => (e.target as EventTarget & { type?: string }).type !== 'search' && touch()}
        className="contents"
        noValidate
      >
        <SheetBody className="space-y-7">
          <Section title="Identificação">
            <div className="space-y-4">
              <FormField
                label="Nome"
                placeholder="Ex.: Ana Ferreira"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  clearError('name')
                }}
                error={errors.name}
                autoFocus={!isEditing}
              />
              <FormField
                label="E-mail (opcional)"
                type="email"
                placeholder="nome@escola.com.br"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearError('email')
                }}
                error={errors.email}
              />
            </div>
          </Section>

          <Section title="Níveis de ensino" hint="Pode marcar mais de um.">
            <div className="flex flex-wrap gap-1.5">
              {allNiveis.map((nivel) => (
                <Toggle key={nivel} pressed={selectedNiveis.includes(nivel)} onClick={() => toggleNivel(nivel)}>
                  {nivel}
                </Toggle>
              ))}
            </div>
          </Section>

          <Section title="Disciplinas" hint="Na matriz das turmas, quem tem a disciplina aparece primeiro.">
            <SubjectPicker
              available={availableSubjects}
              value={selectedSubjects}
              onChange={(next) => {
                touch()
                setSelectedSubjects(next)
                clearError('subjects')
              }}
              onCreate={onAddSubject}
              error={errors.subjects}
            />
          </Section>

          <Section title="Carga e jornada">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Carga máxima por semana (aulas)"
                type="number"
                min={1}
                max={60}
                value={maxWeeklyHours}
                onChange={(e) => {
                  setMaxWeeklyHours(Number(e.target.value))
                  clearError('maxWeeklyHours')
                }}
                error={errors.maxWeeklyHours}
              />
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink/80">Situação</p>
                <Segmented
                  value={status}
                  onChange={(v) => {
                    touch()
                    setStatus(v)
                  }}
                  options={[
                    { value: 'ativo', label: 'Ativo' },
                    { value: 'inativo', label: 'Inativo' },
                  ]}
                />
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-1.5 text-[13px] font-medium text-ink/80">Almoço e aulas por dia</p>
              <Segmented
                value={jornadaPersonalizada ? 'propria' : 'padrao'}
                onChange={(v) => {
                  touch()
                  setJornadaPersonalizada(v === 'propria')
                }}
                options={[
                  { value: 'padrao', label: 'Padrão da escola' },
                  { value: 'propria', label: 'Própria' },
                ]}
              />
              <div className="mt-3">
                {jornadaPersonalizada ? (
                  <JornadaFields value={jornada} errors={jornadaErrors} onChange={setJornada} />
                ) : (
                  <p className="rounded-xl bg-paper px-3.5 py-2.5 text-[13px] text-muted">
                    {resumoJornada(jornadaPadrao)}
                  </p>
                )}
              </div>
            </div>
          </Section>
        </SheetBody>

        <SheetFooter>
          <CancelButton />
          <Button type="submit">{isEditing ? 'Salvar alterações' : 'Cadastrar professor'}</Button>
        </SheetFooter>
      </form>
    </Sheet>
  )
}

function CancelButton() {
  const close = useSheetClose()
  return (
    <Button variant="secondary" onClick={close}>
      Cancelar
    </Button>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="font-display text-[16px] font-bold">{title}</h3>
        {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors',
        pressed ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/30',
      )}
    >
      {pressed && <span aria-hidden>✓</span>}
      {children}
    </button>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex h-11 gap-1 rounded-full bg-paper p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-full text-[13.5px] transition-colors',
            value === o.value ? 'bg-white font-semibold shadow-xs' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Escolhidas no topo; abaixo, busca que filtra a lista e cria a disciplina quando ela não existe. */
function SubjectPicker({
  available,
  value,
  onChange,
  onCreate,
  error,
}: {
  available: string[]
  value: string[]
  onChange: (value: string[]) => void
  onCreate: (name: string) => void
  error?: string
}) {
  const [query, setQuery] = useState('')
  const term = query.trim()
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  const remaining = available.filter((s) => !value.includes(s) && norm(s).includes(norm(term)))
  const exists = available.some((s) => norm(s) === norm(term))

  const add = (subject: string) => {
    onChange([...value, subject])
    setQuery('')
  }
  const create = () => {
    onCreate(term)
    add(term)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!term) return
    const exact = available.find((s) => norm(s) === norm(term))
    if (exact) {
      if (!value.includes(exact)) add(exact)
      else setQuery('')
    } else if (remaining.length > 0) add(remaining[0])
    // Criar só por clique explícito na opção "Criar": um Enter apressado não cadastra nada
  }

  return (
    <div>
      <div className="flex min-h-11 flex-wrap gap-1.5">
        {value.length === 0 ? (
          <p className={cn('self-center text-[13.5px]', error ? 'font-medium text-danger' : 'text-muted')}>
            {error ?? 'Nenhuma disciplina escolhida ainda.'}
          </p>
        ) : (
          value.map((s) => (
            <span
              key={s}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-ink py-0.5 pr-1 pl-3.5 text-[13.5px] font-medium text-white"
            >
              {s}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== s))}
                aria-label={`Remover ${s}`}
                className="grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/15 hover:text-white"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Buscar ou criar disciplina"
          aria-label="Buscar ou criar disciplina"
          className="h-11 w-full border-b border-line-soft bg-paper px-3.5 text-[14px] outline-none focus:bg-white"
        />
        <ul className="grid max-h-52 grid-cols-1 overflow-y-auto p-1 sm:grid-cols-2">
          {remaining.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => add(s)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] hover:bg-paper',
                  term && i === 0 && 'bg-paper font-semibold',
                )}
              >
                <span aria-hidden className="text-muted">
                  +
                </span>
                {s}
              </button>
            </li>
          ))}
          {term && !exists && (
            <li className="sm:col-span-2">
              <button
                type="button"
                onClick={create}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold hover:bg-paper"
              >
                <span aria-hidden className="text-primary">
                  +
                </span>
                Criar “{term}”
              </button>
            </li>
          )}
          {remaining.length === 0 && (!term || exists) && (
            <li className="px-3 py-2 text-[13px] text-muted sm:col-span-2">
              {term ? 'Essa disciplina já foi escolhida.' : 'Todas as disciplinas já foram escolhidas.'}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
