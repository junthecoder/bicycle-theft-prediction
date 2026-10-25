import type { OverlayInsets } from '../hooks/useOverlayInsets'
import type { AreaValue } from '../Map'
import type { Metric } from './period'

export function formatValue(value: AreaValue | undefined, metric: Metric, _population?: number, _minimum?: number): string {
  if (metric === 'count') return `${value?.count ?? 0}件`
  if (!value) return '0'
  return value.rate === null ? '—' : value.rate.toFixed(1)
}

export function focusOptions(_insets: OverlayInsets) {
  return { padding: 60, maxZoom: 16, duration: 800 }
}
