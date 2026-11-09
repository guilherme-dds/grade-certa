/** Avisos do gerador de grade (ex.: disciplina sem professor, aula sem sala) */
export function GenerationWarnings({ avisos }: { avisos?: string[] }) {
  if (!avisos?.length) return null
  return (
    <div className="mt-4 border-t border-black/5 pt-3 text-xs">
      <p className="font-semibold text-warning">Avisos</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
        {avisos.map((aviso) => (
          <li key={aviso}>{aviso}</li>
        ))}
      </ul>
    </div>
  )
}
