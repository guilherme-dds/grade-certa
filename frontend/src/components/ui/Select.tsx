import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
  /** Texto secundário à direita (ex.: data de uma grade) */
  hint?: string
  /** Opções com o mesmo grupo aparecem juntas, sob um título */
  group?: string
  disabled?: boolean
}

type Variant = 'pill' | 'field' | 'ghost' | 'dashed' | 'dark'

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Nome acessível; também vira o prefixo visível quando `prefix` é true (ex.: "Grade:") */
  label: string
  prefix?: boolean
  placeholder?: string
  variant?: Variant
  size?: 'sm' | 'md'
  disabled?: boolean
  /** Campo de busca no topo; por padrão aparece com mais de 8 opções */
  searchable?: boolean
  id?: string
  className?: string
  /** Largura mínima da lista (padrão: a do botão) */
  menuMinWidth?: number
}

const trigger: Record<Variant, string> = {
  pill: 'rounded-full border border-line bg-white hover:border-ink/25 data-[open]:border-ink',
  field:
    'w-full rounded-2xl border border-line bg-paper hover:border-ink/20 data-[open]:border-ink data-[open]:bg-white data-[open]:ring-4 data-[open]:ring-ink/8',
  ghost:
    'w-full rounded-xl border border-transparent bg-transparent hover:border-line hover:bg-white data-[open]:border-ink data-[open]:bg-white',
  dashed: 'rounded-lg border border-dashed border-line bg-white text-muted hover:border-ink/30 hover:text-ink',
  dark: 'w-full rounded-xl border border-white/15 bg-white/[0.07] text-white hover:border-white/30 data-[open]:border-white/50',
}

const heights = {
  pill: { sm: 'h-9 px-3.5 text-[13px]', md: 'h-10 px-4 text-[13.5px]' },
  field: { sm: 'h-10 px-3.5 text-[14px]', md: 'h-11 px-3.5 text-[14px]' },
  ghost: { sm: 'h-9 px-2 text-[14px]', md: 'h-10 px-2 text-[14.5px] font-semibold' },
  dashed: { sm: 'h-7 px-2 text-xs', md: 'h-8 px-2.5 text-[12.5px]' },
  dark: { sm: 'h-10 px-3 text-[14px]', md: 'h-11 px-3.5 text-[14px]' },
}

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Seletor da plataforma: botão no estilo da interface e lista própria (em vez da lista nativa do navegador).
 * A lista abre na camada do topo (Popover API), então funciona dentro de diálogos e painéis com rolagem.
 */
export function Select({
  value,
  onChange,
  options,
  label,
  prefix = false,
  placeholder = 'Escolha…',
  variant = 'pill',
  size = 'md',
  disabled,
  searchable,
  id,
  className,
  menuMinWidth,
}: SelectProps) {
  const autoId = useId()
  const buttonId = id ?? `${autoId}-button`
  const listId = `${autoId}-list`
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const typeahead = useRef({ text: '', at: 0 })
  // Clique fora fecha a lista antes do clique no botão chegar; sem isto, o mesmo clique a reabriria
  const fechadaEm = useRef(0)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number; above: boolean }>()

  const comBusca = searchable ?? options.length > 8
  const selected = options.find((o) => o.value === value)
  const visiveis = useMemo(() => {
    const q = normalizar(query.trim())
    return q ? options.filter((o) => normalizar(`${o.label} ${o.hint ?? ''}`).includes(q)) : options
  }, [options, query])

  // Posição da lista: abaixo do botão, ou acima se não couber
  const posicionar = () => {
    const b = buttonRef.current?.getBoundingClientRect()
    if (!b) return
    const espacoAbaixo = window.innerHeight - b.bottom - 12
    const espacoAcima = b.top - 12
    const above = espacoAbaixo < 240 && espacoAcima > espacoAbaixo
    const width = Math.max(b.width, menuMinWidth ?? 0, 180)
    const left = Math.min(Math.max(8, b.left), window.innerWidth - width - 8)
    setPos({
      top: above ? b.top - 6 : b.bottom + 6,
      left,
      width,
      maxHeight: Math.min(340, above ? espacoAcima : espacoAbaixo),
      above,
    })
  }

  const abrir = () => {
    if (disabled) return
    posicionar()
    setQuery('')
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    )
    setOpen(true)
  }

  const fechar = (devolverFoco = true) => {
    setOpen(false)
    if (devolverFoco) buttonRef.current?.focus()
  }

  const escolher = (opcao: SelectOption | undefined) => {
    if (!opcao || opcao.disabled) return
    if (opcao.value !== value) onChange(opcao.value)
    fechar()
  }

  // Abre/fecha a camada do topo junto com o estado
  useLayoutEffect(() => {
    const pop = popRef.current
    if (!pop) return
    try {
      if (open && !pop.matches(':popover-open')) pop.showPopover()
      if (!open && pop.matches(':popover-open')) pop.hidePopover()
    } catch {
      // Navegador sem Popover API: a lista ainda aparece como elemento fixo
    }
    if (open) (comBusca ? searchRef.current : listRef.current)?.focus({ preventScroll: true })
  }, [open, comBusca])

  // Rolagem ou redimensionamento: a lista acompanha o botão
  useEffect(() => {
    if (!open) return
    const onMove = (e: Event) => {
      if (e.target instanceof Node && popRef.current?.contains(e.target)) return
      posicionar()
    }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Mantém a opção ativa à vista
  useEffect(() => {
    if (!open || active < 0) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const mover = (delta: number) => {
    if (visiveis.length === 0) return
    let i = active
    for (let n = 0; n < visiveis.length; n++) {
      i = (i + delta + visiveis.length) % visiveis.length
      if (!visiveis[i].disabled) break
    }
    setActive(i)
  }

  const onButtonKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      abrir()
    }
  }

  const onListKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mover(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      mover(-1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(visiveis.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      escolher(visiveis[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      fechar()
    } else if (e.key === 'Tab') {
      fechar(false)
    } else if (!comBusca && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // Digitar as primeiras letras pula para a opção
      const agora = Date.now()
      const t = typeahead.current
      t.text = agora - t.at < 600 ? t.text + e.key : e.key
      t.at = agora
      const i = visiveis.findIndex((o) => normalizar(o.label).startsWith(normalizar(t.text)))
      if (i >= 0) setActive(i)
    }
  }

  // Grupos na ordem em que aparecem
  const linhas: ({ tipo: 'grupo'; nome: string } | { tipo: 'opcao'; opcao: SelectOption; index: number })[] = []
  let grupoAtual: string | undefined
  visiveis.forEach((opcao, index) => {
    if (opcao.group && opcao.group !== grupoAtual) linhas.push({ tipo: 'grupo', nome: opcao.group })
    grupoAtual = opcao.group
    linhas.push({ tipo: 'opcao', opcao, index })
  })

  return (
    <>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={selected || placeholder !== label ? `${label}: ${selected?.label ?? placeholder}` : label}
        data-open={open ? '' : undefined}
        onClick={() => {
          if (open) fechar()
          else if (Date.now() - fechadaEm.current > 250) abrir()
        }}
        onKeyDown={onButtonKey}
        className={cn(
          'group inline-flex min-w-0 items-center gap-1.5 text-left outline-none transition-colors focus-visible:ring-4 focus-visible:ring-ink/10 disabled:cursor-not-allowed disabled:opacity-50',
          trigger[variant],
          heights[variant][size],
          className,
        )}
      >
        {prefix && (
          <span className={cn('shrink-0', variant === 'dark' ? 'text-white/60' : 'text-muted')}>{label}:</span>
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            variant !== 'dashed' && 'font-medium',
            !selected && variant !== 'dashed' && (variant === 'dark' ? 'text-white/50' : 'text-muted'),
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-200 group-data-[open]:rotate-180',
            variant === 'dark' ? 'text-white/60' : 'text-muted',
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      <div
        ref={popRef}
        popover="auto"
        onToggle={(e) => {
          // Fechou por clique fora ou Esc (light dismiss do navegador)
          if ((e as unknown as ToggleEvent).newState === 'closed' && open) {
            fechadaEm.current = Date.now()
            setOpen(false)
          }
        }}
        style={
          pos
            ? {
                top: pos.above ? undefined : pos.top,
                bottom: pos.above ? window.innerHeight - pos.top : undefined,
                left: pos.left,
                width: pos.width,
              }
            : undefined
        }
        className={cn(
          'fixed inset-auto m-0 hidden overflow-hidden rounded-2xl border border-line-soft bg-white p-0 text-ink shadow-[0_18px_48px_-16px_rgb(21_22_26/0.35)] [&:popover-open]:flex [&:popover-open]:flex-col',
          'animate-[select-in_140ms_cubic-bezier(0.2,0.8,0.2,1)]',
          pos?.above ? 'origin-bottom' : 'origin-top',
        )}
      >
        {comBusca && (
          <div className="border-b border-line-soft p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onListKey}
              placeholder="Buscar…"
              aria-label={`Buscar em ${label}`}
              aria-controls={listId}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              className="h-9 w-full rounded-xl bg-paper px-3 text-[13.5px] outline-none placeholder:text-muted focus:bg-line-soft"
            />
          </div>
        )}
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          tabIndex={comBusca ? -1 : 0}
          aria-activedescendant={!comBusca && active >= 0 ? `${listId}-${active}` : undefined}
          onKeyDown={comBusca ? undefined : onListKey}
          style={{ maxHeight: pos ? pos.maxHeight - (comBusca ? 53 : 0) : 300 }}
          className="overflow-y-auto overscroll-contain p-1.5 outline-none"
        >
          {visiveis.length === 0 && <li className="px-3 py-2.5 text-[13.5px] text-muted">Nada encontrado.</li>}
          {linhas.map((linha) =>
            linha.tipo === 'grupo' ? (
              <li
                key={`g-${linha.nome}`}
                role="presentation"
                className="px-3 pt-2.5 pb-1 text-[11.5px] font-semibold text-muted first:pt-1"
              >
                {linha.nome}
              </li>
            ) : (
              <SelectItem
                key={linha.opcao.value}
                id={`${listId}-${linha.index}`}
                index={linha.index}
                opcao={linha.opcao}
                selecionada={linha.opcao.value === value}
                ativa={linha.index === active}
                onHover={() => setActive(linha.index)}
                onPick={() => escolher(linha.opcao)}
              />
            ),
          )}
        </ul>
      </div>
    </>
  )
}

function SelectItem({
  id,
  index,
  opcao,
  selecionada,
  ativa,
  onHover,
  onPick,
}: {
  id: string
  index: number
  opcao: SelectOption
  selecionada: boolean
  ativa: boolean
  onHover: () => void
  onPick: () => void
}): ReactNode {
  return (
    <li
      id={id}
      data-index={index}
      role="option"
      aria-selected={selecionada}
      aria-disabled={opcao.disabled || undefined}
      onMouseMove={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[14px]',
        ativa && 'bg-paper',
        selecionada && 'font-semibold',
        opcao.disabled && 'cursor-not-allowed opacity-45',
      )}
    >
      <span className="min-w-0 flex-1 truncate">{opcao.label}</span>
      {opcao.hint && <span className="shrink-0 text-[12.5px] font-normal text-muted tabular-nums">{opcao.hint}</span>}
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={cn('size-4 shrink-0 text-primary', !selecionada && 'invisible')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3.5 8.5 3 3 6-7" />
      </svg>
    </li>
  )
}
