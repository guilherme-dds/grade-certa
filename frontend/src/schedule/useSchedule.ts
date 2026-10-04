import { useContext } from 'react'
import { ScheduleContext } from './ScheduleContext'

export function useSchedule() {
  const ctx = useContext(ScheduleContext)
  if (!ctx) throw new Error('useSchedule deve ser usado dentro de <ScheduleProvider>')
  return ctx
}
