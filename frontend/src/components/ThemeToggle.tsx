import { Icon } from '@/components/ui/Icon'
import { setTema, useTema } from '@/lib/theme'

/** Alterna entre o tema claro e o escuro; o ícone mostra para qual tema o botão leva. */
export function ThemeToggle() {
  const tema = useTema()
  const escuro = tema === 'escuro'
  const rotulo = escuro ? 'Usar tema claro' : 'Usar tema escuro'

  return (
    <button
      type="button"
      onClick={() => setTema(escuro ? 'claro' : 'escuro')}
      aria-label={rotulo}
      title={rotulo}
      className="group grid size-11 place-items-center rounded-full bg-white shadow-(--shadow-float) transition-colors hover:bg-paper"
    >
      <Icon
        key={tema}
        name={escuro ? 'sun' : 'moon'}
        className="animate-[theme-swap_320ms_cubic-bezier(0.2,0.8,0.2,1)] group-hover:text-primary"
      />
    </button>
  )
}
