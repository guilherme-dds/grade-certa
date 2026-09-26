import { cn } from '@/lib/cn'

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-line bg-white text-ink hover:bg-paper',
  dark: 'bg-navy text-white hover:bg-navy/90',
}

const sizes = {
  sm: 'px-3.5 py-2 text-[12.5px]',
  md: 'px-4 py-2.5 text-[13px]',
  lg: 'px-4 py-3 text-sm',
}

export interface ButtonStyleProps {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

/** Classes de botão; use também em <Link> para links com cara de botão. */
export function buttonStyles({ variant = 'primary', size = 'md' }: ButtonStyleProps = {}, className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  )
}
