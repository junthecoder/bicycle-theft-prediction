import type { CategoryCount } from '../client'

interface BarsProps {
  values: number[]
  labels: string[]
  /** CSS class per bar label, e.g. saturday / holiday colouring */
  labelClass?: (index: number) => string
  selected?: (index: number) => boolean
  onClick?: (index: number) => void
  title?: (index: number) => string
}

export function Bars({ values, labels, labelClass, selected, onClick, title }: BarsProps) {
  const max = Math.max(1, ...values)
  const anySelected = selected ? values.some((_, i) => selected(i)) : false
  return (
    <div>
      <div className={`bars${onClick ? ' clickable' : ''}`}>
        {values.map((value, i) => {
          const isSelected = selected?.(i) ?? false
          const className = `bar${isSelected ? ' selected' : anySelected ? ' dim' : ''}`
          return (
            <div
              key={i}
              className={className}
              style={{ height: `${(value / max) * 100}%` }}
              title={title ? title(i) : `${labels[i]}: ${value}件`}
              onClick={onClick ? () => onClick(i) : undefined}
              role={onClick ? 'button' : undefined}
              tabIndex={onClick ? 0 : undefined}
              aria-label={onClick ? (title ? title(i) : `${labels[i]}: ${value}件`) : undefined}
              onKeyDown={onClick ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onClick(i)
                }
              } : undefined}
            />
          )
        })}
      </div>
      <div className="bar-labels">
        {labels.map((label, i) => (
          <span key={i} className={labelClass?.(i)}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

interface CategoryListProps {
  items: CategoryCount[]
  total: number
}

export function CategoryList({ items, total }: CategoryListProps) {
  if (items.length === 0) return <div className="notice">該当する記録はありません</div>
  return (
    <div className="category-list">
      {items.map((item) => (
        <div key={item.label} className="category-row">
          <span>{item.label}</span>
          <span className="count">
            {item.count}件{total > 0 && ` (${Math.round((item.count / total) * 100)}%)`}
          </span>
          <div className="track">
            <div className="fill" style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Fixed categorical slots (validated for colour-vision deficiency); the fold slice is grey on purpose.
const SLICE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']
const OTHER_COLOR = '#6b7280'
const OTHER_LABEL = 'その他・不明'
const MAX_SLICES = SLICE_COLORS.length
const DONUT_SIZE = 112
const RING_RADIUS = 40
const RING_WIDTH = 18
// Gap between slices, in px of circumference, so adjacent colours never touch.
const SLICE_GAP = 2
// A slice shorter than the gap would vanish while still listed in the legend; keep a visible tick.
const MIN_DASH = 1
// Totals with more digits than this get a smaller centre label so they fit the hole.
const SHORT_LABEL_LENGTH = 5

interface Slice {
  label: string
  count: number
  color: string
}

/**
 * Up to five named categories plus one grey slice for everything else: the categories the API
 * cut off, rows with the value missing, and the data's own その他 bucket (merged so two "other"
 * slices never sit side by side).
 */
function donutSlices(items: CategoryCount[], total: number): Slice[] {
  const named = items.filter((item) => item.label !== 'その他').slice(0, MAX_SLICES)
  const slices = named.map((item, i) => ({ ...item, color: SLICE_COLORS[i] }))
  const rest = total - named.reduce((sum, item) => sum + item.count, 0)
  if (rest > 0) slices.push({ label: OTHER_LABEL, count: rest, color: OTHER_COLOR })
  return slices
}

interface DonutProps {
  items: CategoryCount[]
  total: number
}

/** Part-to-whole donut with a legend; each slice is a dashed stroke of one circle, so a lone slice is a full ring. */
export function Donut({ items, total }: DonutProps) {
  if (total === 0) return <div className="notice">該当する記録はありません</div>
  const slices = donutSlices(items, total)
  const circumference = 2 * Math.PI * RING_RADIUS
  const gap = slices.length > 1 ? SLICE_GAP : 0
  const centre = DONUT_SIZE / 2
  const percent = (count: number) => `${Math.round((count / total) * 100)}%`
  const label = total.toLocaleString()
  // Where each slice starts along the ring: the lengths of the slices before it.
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((sum, s) => sum + (s.count / total) * circumference, 0))
  return (
    <div className="donut">
      <svg viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} role="img" aria-label={slices.map((s) => `${s.label} ${s.count}件`).join('、')}>
        <g transform={`rotate(-90 ${centre} ${centre})`}>
          {slices.map((slice, i) => {
            const length = (slice.count / total) * circumference
            const dash = Math.max(length - gap, Math.min(length, MIN_DASH))
            return (
              <circle
                key={slice.label}
                cx={centre}
                cy={centre}
                r={RING_RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={RING_WIDTH}
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={-starts[i]}
              >
                <title>{`${slice.label}: ${slice.count}件 (${percent(slice.count)})`}</title>
              </circle>
            )
          })}
        </g>
        <text
          x={centre}
          y={centre}
          className={`donut-total${label.length > SHORT_LABEL_LENGTH ? ' long' : ''}`}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
          <tspan className="unit">件</tspan>
        </text>
      </svg>
      <ul className="donut-legend">
        {slices.map((slice) => (
          <li key={slice.label}>
            <span className="dot" style={{ background: slice.color }} />
            <span className="label">{slice.label}</span>
            <span className="count">
              {slice.count.toLocaleString()}件 ({percent(slice.count)})
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
