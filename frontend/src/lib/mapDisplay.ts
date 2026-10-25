import type { OverlayInsets } from '../hooks/useOverlayInsets'
import type { AreaValue } from '../Map'
import type { Metric } from './period'

export function formatValue(value: AreaValue | undefined, metric: Metric, population: number, minimum: number): string {
  if (metric === 'count') return `${value?.count ?? 0}件`
  if (population < minimum) return '—'
  if (!value) return '0.0'
  return value.rate === null ? '—' : value.rate.toFixed(1)
}

export function focusOptions(insets: OverlayInsets) {
  return {
    padding: { top: insets.top + 24, right: insets.right + 24, bottom: insets.bottom + 24, left: 24 },
    // fitBounds otherwise stores its temporary padding and displaces later pans.
    retainPadding: false,
    maxZoom: 16,
    duration: 800,
  }
}
