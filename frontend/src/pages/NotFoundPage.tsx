import { Link } from 'react-router'
import { buttonStyles } from '@/components/ui/buttonStyles'

export function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="text-[22px] font-bold">Página não encontrada</h1>
      <Link to="/" className={buttonStyles({ variant: 'secondary' })}>
        Voltar para o início
      </Link>
    </main>
  )
}
