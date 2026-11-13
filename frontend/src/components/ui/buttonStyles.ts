import { cn } from '@/lib/cn'

const variants = {
  primary: 'bg-ink text-white shadow-[0_6px_16px_-8px_rgb(21_22_26/0.55)] hover:bg-ink-soft',
  secondary: 'border border-line bg-white text-ink hover:border-ink/25 hover:bg-paper',
  dark: 'bg-ink text-white hover:bg-ink-soft',
}

const sizes = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-10 px-5 text-[13.5px]',
  lg: 'h-12 px-6 text-[15px]',
}

export interface ButtonStyleProps {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

/** Classes de botão; use também em <Link> para links com cara de botão. */
export function buttonStyles({ variant = 'primary', size = 'md' }: ButtonStyleProps = {}, className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,border-color,transform] active:scale-[0.98]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
    'disabled:pointer-events-none disabled:opacity-45',
    variants[variant],
    sizes[size],
    className,
  )
}
