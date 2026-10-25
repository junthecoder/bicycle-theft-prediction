import { METRIC_LABELS, type Metric } from '../lib/period'

export default function MetricSelector({ metric, onMetric }: { metric: Metric; onMetric: (metric: Metric) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="表示する指標">
      {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={metric === m}
          className={metric === m ? 'active' : ''} onClick={() => onMetric(m)}>
          {METRIC_LABELS[m]}
        </button>
      ))}
    </div>
  )
}
