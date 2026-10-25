import { NA_COLOR, RAMP, UNRECORDED_COLOR } from '../lib/color'
import { METRIC_LABELS, type Metric } from '../lib/period'

interface Props {
  metric: Metric
  onMetric: (metric: Metric) => void
  domainMax: number
  locked: boolean
  onLocked: (locked: boolean) => void
  minPopulationForRate: number
  populationYear: number
  unmapped: number
}

function Legend({ metric, onMetric, domainMax, locked, onLocked, minPopulationForRate, populationYear, unmapped }: Props) {
  const unit = metric === 'count' ? '件' : '件/千人'
  const mid = domainMax / 2
  const format = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
  return (
    <div className="panel legend">
      <div className="segmented" role="radiogroup" aria-label="表示する指標">
        {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={metric === m}
            className={metric === m ? 'active' : ''}
            onClick={() => onMetric(m)}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>
      <div>
        <div className="legend-bar" style={{ background: `linear-gradient(to right, ${RAMP.join(', ')})` }} />
        <div className="legend-ticks">
          <span>0{unit}</span>
          <span>{format(mid)}</span>
          <span>{format(domainMax)}+</span>
        </div>
      </div>
      <div className="legend-row">
        <span className="swatch" style={{ background: 'transparent' }} />
        <span>0件は塗りなし</span>
      </div>
      {metric === 'rate' && (
        <div className="legend-row">
          <span className="swatch" style={{ background: NA_COLOR }} />
          <span>人口{minPopulationForRate}人未満は算出せず（{populationYear}年国勢調査）</span>
        </div>
      )}
      <div className="legend-row">
        <span className="swatch" style={{ background: UNRECORDED_COLOR }} />
        <span title="データ全体を通して1件も記録がない町丁目。警察がこの名前で記録していないとみられます">記録対象外の町丁目（全期間で0件）</span>
      </div>
      <label>
        <input type="checkbox" checked={locked} onChange={(e) => onLocked(e.target.checked)} />
        色の範囲を固定して日付を比較
      </label>
      {unmapped > 0 && <div className="legend-row">地図に載せられない件数: {unmapped}件</div>}
    </div>
  )
}

export default Legend
