import holidayJp from '@holiday-jp/holiday_jp'

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

/** How a date should be coloured: Saturdays blue, Sundays and holidays red, everything else black. */
export type DayKind = 'weekday' | 'saturday' | 'holiday'

const MS_PER_DAY = 86_400_000

/** Parse YYYY-MM-DD as local midnight; `new Date('YYYY-MM-DD')` would be UTC and shift the day west of Japan. */
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseISODate(toIso).getTime() - parseISODate(fromIso).getTime()) / MS_PER_DAY)
}

export function clampDate(iso: string, min: string, max: string): string {
  return iso < min ? min : iso > max ? max : iso
}

export function isJapaneseHoliday(iso: string): boolean {
  return holidayJp.isHoliday(parseISODate(iso))
}

export function dayKind(iso: string): DayKind {
  const day = parseISODate(iso).getDay()
  if (day === 0 || isJapaneseHoliday(iso)) return 'holiday'
  return day === 6 ? 'saturday' : 'weekday'
}

export function weekdayLabel(iso: string): string {
  return WEEKDAY_LABELS[parseISODate(iso).getDay()]
}

export function formatJapaneseDate(iso: string): string {
  const date = parseISODate(iso)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatShortDate(iso: string): string {
  const date = parseISODate(iso)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

export function formatYearMonth(iso: string): string {
  const date = parseISODate(iso)
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}
