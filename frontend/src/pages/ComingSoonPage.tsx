import { Link } from 'react-router'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { PageHeader } from '@/components/ui/PageHeader'

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="max-w-xl rounded-lg border border-dashed border-line bg-white px-6 py-8">
        <p className="text-sm font-semibold">Em construção</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          O fluxo desta tela ainda está sendo definido.
        </p>
        <Link to="/" className={buttonStyles({ variant: 'secondary', size: 'sm' }, 'mt-4')}>
          Voltar ao dashboard
        </Link>
      </div>
    </>
  )
}
