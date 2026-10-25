import { dayKind, formatJapaneseDate, isJapaneseHoliday, weekdayLabel } from '../lib/date'

interface Props {
  iso: string
}

/** Date with weekday; blue on Saturdays, red on Sundays and public holidays (marked 祝). */
function DateLabel({ iso }: Props) {
  return (
    <div className={`date-label ${dayKind(iso)}`}>
      {formatJapaneseDate(iso)}
      <span className="weekday">（{weekdayLabel(iso)}）</span>
      {isJapaneseHoliday(iso) && <span className="weekday">(祝)</span>}
    </div>
  )
}

export default DateLabel
