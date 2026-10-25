/** The time selection shared by every panel: a window of `days` ending on `end`, restricted to a band of hours. */
export interface Period {
  /** YYYY-MM-DD, inclusive last day of the window */
  end: string
  days: number
  /** First hour of the band, 0–23 */
  hourFrom: number
  /** Length of the band in hours, 1–24; 24 means the whole day */
  hourSpan: number
}

export type Metric = 'count' | 'rate'

export const METRIC_LABELS: Record<Metric, string> = {
  count: '件数',
  rate: '人口千人あたり',
}

export const WINDOW_OPTIONS: { days: number; label: string }[] = [
  { days: 1, label: '1日' },
  { days: 7, label: '7日' },
  { days: 30, label: '30日' },
  { days: 90, label: '90日' },
  { days: 365, label: '1年' },
]

export const HOUR_PRESETS: { label: string; hourFrom: number; hourSpan: number }[] = [
  { label: '終日', hourFrom: 0, hourSpan: 24 },
  { label: '朝 6–9時', hourFrom: 6, hourSpan: 4 },
  { label: '昼 10–16時', hourFrom: 10, hourSpan: 7 },
  { label: '夕方 17–21時', hourFrom: 17, hourSpan: 5 },
  { label: '深夜 22–5時', hourFrom: 22, hourSpan: 8 },
]

export function isFullDay(period: Period): boolean {
  return period.hourSpan >= 24
}

/** Inclusive last hour; wraps past midnight, e.g. from 22 for 8 hours ends at 5. */
export function hourTo(period: Period): number {
  return (period.hourFrom + period.hourSpan - 1) % 24
}

export function hourRange(period: Period): { hourFrom: number; hourTo: number } {
  return isFullDay(period) ? { hourFrom: 0, hourTo: 23 } : { hourFrom: period.hourFrom, hourTo: hourTo(period) }
}

export function isHourSelected(period: Period, hour: number): boolean {
  if (isFullDay(period)) return true
  const { hourFrom, hourTo: to } = hourRange(period)
  return hourFrom <= to ? hour >= hourFrom && hour <= to : hour >= hourFrom || hour <= to
}

export function formatHourBand(period: Period): string {
  if (isFullDay(period)) return '終日'
  const { hourFrom, hourTo: to } = hourRange(period)
  const endLabel = to + 1 === 24 ? '24時' : `${to + 1}時`
  return `${hourFrom}時〜${endLabel}${to < hourFrom ? '（翌日）' : ''}`
}

export function periodKey(period: Period): string {
  const { hourFrom, hourTo: to } = hourRange(period)
  return `${period.end}|${period.days}|${hourFrom}|${to}`
}
