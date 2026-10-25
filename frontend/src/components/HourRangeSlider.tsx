import { hourThumbs, type Period, periodFromThumbs } from '../lib/period'

interface Props {
  period: Period
  onChange: (band: Pick<Period, 'hourFrom' | 'hourSpan'>) => void
}

const HOURS = 24
const TICKS = [0, 6, 12, 18, 24]
// Matches the thumb size in App.css; a native range thumb only travels width - thumb, so the
// filled track has to be offset the same way to line up with the thumb centres.
const THUMB_PX = 16

function thumbOffset(value: number): string {
  return `calc(${THUMB_PX / 2}px + (100% - ${THUMB_PX}px) * ${value / HOURS})`
}

/** Two thumbs on one 0–24 track. Dragging the end thumb left of the start thumb wraps the band past midnight. */
function HourRangeSlider({ period, onChange }: Props) {
  const { start, end } = hourThumbs(period)
  // A wrapped (or whole-day) band fills the track in two pieces: start → 24 and 0 → end.
  const fills = end > start ? [[start, end]] : [[start, HOURS], [0, end]]
  return (
    <div className="range-slider">
      <div className="track">
        {fills.map(([from, to]) => (
          <div key={from} className="fill" style={{ left: thumbOffset(from), right: `calc(100% - ${thumbOffset(to)})` }} />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={HOURS - 1}
        value={start}
        onChange={(e) => onChange(periodFromThumbs(Number(e.target.value), end))}
        aria-label="開始時刻"
        aria-valuetext={`${start}時`}
      />
      <input
        type="range"
        min={1}
        max={HOURS}
        value={end}
        onChange={(e) => onChange(periodFromThumbs(start, Number(e.target.value)))}
        aria-label="終了時刻"
        aria-valuetext={`${end}時`}
      />
      <div className="ticks" aria-hidden>
        {TICKS.map((tick) => (
          <span key={tick} style={{ left: thumbOffset(tick) }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  )
}

export default HourRangeSlider
