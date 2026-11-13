import type { Key, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => Key
  caption?: string
}

export function DataTable<T>({ columns, rows, rowKey, caption }: DataTableProps<T>) {
  return (
    <div className="card overflow-x-auto px-2 pb-2">
      <table className="w-full border-collapse text-[13.5px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="text-left">
            {columns.map((col) => (
              <th
                key={col.header}
                scope="col"
                className="px-3.5 pt-4 pb-3 text-[12.5px] font-medium whitespace-nowrap text-muted"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-line-soft transition-colors hover:bg-paper/70">
              {columns.map((col) => (
                <td key={col.header} className={cn('px-3.5 py-3', col.className)}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
