import type { TimelinePoint } from '../client'
import { addDays, daysBetween, formatShortDate } from '../lib/date'
import { formatHourBand, HOUR_PRESETS, isFullDay, type Period, WINDOW_OPTIONS, windowStart } from '../lib/period'
import DateLabel from './DateLabel'
import HourRangeSlider from './HourRangeSlider'

interface Props {
  dateMin: string
  dateMax: string
  period: Period
  onChange: (period: Period) => void
  timeline: TimelinePoint[] | undefined
  playing: boolean
  onTogglePlay: () => void
}

const SPARK_WIDTH = 1000
const SPARK_HEIGHT = 40

function Sparkline({ dateMin, dateMax, period, timeline }: Pick<Props, 'dateMin' | 'dateMax' | 'period' | 'timeline'>) {
  const totalDays = Math.max(1, daysBetween(dateMin, dateMax))
  const x = (iso: string) => (Math.min(Math.max(daysBetween(dateMin, iso), 0), totalDays) / totalDays) * SPARK_WIDTH
  const max = Math.max(1, ...(timeline ?? []).map((p) => p.count))
  const start = windowStart(period, dateMin)
  const windowX = x(start)
  const windowWidth = Math.max(2, x(addDays(period.end, 1)) - windowX)
  return (
    <svg className="sparkline" viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} preserveAspectRatio="none" aria-hidden>
      {timeline?.map((point) => {
        const left = x(point.month)
        const nextMonth = addDays(point.month, 32).slice(0, 7) + '-01'
        const width = Math.max(1, x(nextMonth) - left - 1)
        const height = (point.count / max) * (SPARK_HEIGHT - 2)
        const inWindow = point.month <= period.end && nextMonth > start
        return (
          <rect
            key={point.month}
            className={`bar${inWindow ? ' in-window' : ''}`}
            x={left}
            y={SPARK_HEIGHT - height}
            width={width}
            height={height}
          />
        )
      })}
      <rect className="window" x={windowX} y={0} width={windowWidth} height={SPARK_HEIGHT} />
    </svg>
  )
}

function TimeControls({ dateMin, dateMax, period, onChange, timeline, playing, onTogglePlay }: Props) {
  const totalDays = daysBetween(dateMin, dateMax)
  const index = daysBetween(dateMin, period.end)
  const setEnd = (iso: string) => onChange({ ...period, end: iso })
  const step = (days: number) => {
    const next = addDays(period.end, days)
    setEnd(next < dateMin ? dateMin : next > dateMax ? dateMax : next)
  }
  const start = windowStart(period, dateMin)

  return (
    <div className="controls">
      <div className="date-row">
        <DateLabel iso={period.end} />
        <button type="button" className="icon-button" onClick={() => step(-1)} aria-label="前日" title="前日">
          ‹
        </button>
        <button type="button" className="icon-button" onClick={() => step(1)} aria-label="翌日" title="翌日">
          ›
        </button>
        <button
          type="button"
          className={`icon-button${playing ? ' active' : ''}`}
          onClick={onTogglePlay}
          aria-label={playing ? '停止' : '再生'}
          title={playing ? '停止' : '日付を進めて再生'}
        >
          {playing ? '■' : '▶'}
        </button>
      </div>

      <div className="field">
        <Sparkline dateMin={dateMin} dateMax={dateMax} period={period} timeline={timeline} />
        <input
          className="slider"
          type="range"
          min={0}
          max={totalDays}
          value={index}
          onChange={(e) => setEnd(addDays(dateMin, Number(e.target.value)))}
          aria-label="日付"
        />
        <div className="field-label">
          <span>{formatShortDate(dateMin)}</span>
          <span>
            集計期間 <strong>{formatShortDate(start)}</strong> 〜 <strong>{formatShortDate(period.end)}</strong>
          </span>
          <span>{formatShortDate(dateMax)}</span>
        </div>
      </div>

      <div className="field">
        <div className="field-label">
          <span>集計期間（選択日まで）</span>
        </div>
        <div className="segmented" role="radiogroup" aria-label="集計期間">
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={period.days === option.days}
              className={period.days === option.days ? 'active' : ''}
              onClick={() => onChange({ ...period, days: option.days })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="field-label">
          <span>時間帯</span>
          <strong>{formatHourBand(period)}</strong>
        </div>
        <div className="chips">
          {HOUR_PRESETS.map((preset) => {
            const active =
              isFullDay(period) && preset.hourSpan === 24
                ? true
                : period.hourFrom === preset.hourFrom && period.hourSpan === preset.hourSpan
            return (
              <button
                key={preset.label}
                type="button"
                className={`chip${active ? ' active' : ''}`}
                onClick={() => onChange({ ...period, hourFrom: preset.hourFrom, hourSpan: preset.hourSpan })}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <HourRangeSlider period={period} onChange={(band) => onChange({ ...period, ...band })} />
      </div>
    </div>
  )
}

export default TimeControls
