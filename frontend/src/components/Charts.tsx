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
