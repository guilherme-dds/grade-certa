import type { ReactNode } from 'react'

interface ReportSectionProps {
  title: string
  summary: ReactNode
  children: ReactNode
}

/** Bloco de um relatório. Na impressão, cada bloco começa em uma folha. */
export function ReportSection({ title, summary, children }: ReportSectionProps) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 print:break-after-page print:border-0 print:p-0 print:last:break-after-auto">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-[12.5px] text-muted">{summary}</p>
      </header>
      {children}
    </section>
  )
}
