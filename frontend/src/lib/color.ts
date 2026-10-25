import type { ExpressionSpecification } from 'maplibre-gl'

/** Sequential yellow → red ramp (ColorBrewer YlOrRd) for the choropleth. */
export const RAMP = ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026']
/** Areas where a per-capita rate is not meaningful (almost nobody lives there). */
export const NA_COLOR = '#c9d1d9'
/** Areas without thefts keep the basemap visible. */
export const ZERO_COLOR = 'rgba(255,255,255,0)'
/** Areas the police never file thefts under (no record in the whole data). */
export const UNRECORDED_COLOR = '#4b5563'

/** Round up to a "nice" number (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 × 10^n) so legend labels stay readable. */
export function niceCeil(x: number): number {
  if (x <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(x))
  const fraction = x / magnitude
  const nice = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((n) => n >= fraction - 1e-9) ?? 10
  return nice * magnitude
}

/**
 * Upper end of the colour scale: the 98th percentile of positive values, so one or two extreme
 * areas (train stations, nightlife districts) don't wash out the rest of the city.
 */
export function robustMax(values: number[], floor: number): number {
  const positive = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (positive.length === 0) return floor
  const p98 = positive[Math.min(positive.length - 1, Math.floor(positive.length * 0.98))]
  return Math.max(floor, niceCeil(p98))
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Same mapping as the map expression, for legend swatches and ranking rows. */
export function colorFor(value: number | null, max: number): string {
  if (value === null) return NA_COLOR
  if (value <= 0) return ZERO_COLOR
  const t = Math.min(1, value / max) * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(t))
  const f = t - i
  const a = hexToRgb(RAMP[i])
  const b = hexToRgb(RAMP[i + 1])
  const mix = a.map((c, k) => Math.round(c + (b[k] - c) * f))
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`
}

/**
 * Fill colour driven by feature state: `unrecorded` areas are dark grey; otherwise `value`
 * -1 = not applicable, 0 = no thefts, >0 = ramp.
 */
export function fillColorExpression(max: number): ExpressionSpecification {
  const value = ['coalesce', ['feature-state', 'value'], 0]
  const stops = RAMP.flatMap((color, i) => [(max * i) / (RAMP.length - 1), color])
  return [
    'case',
    ['boolean', ['feature-state', 'unrecorded'], false],
    UNRECORDED_COLOR,
    ['<', value, 0],
    NA_COLOR,
    ['==', value, 0],
    ZERO_COLOR,
    ['interpolate', ['linear'], value, ...stops],
  ] as unknown as ExpressionSpecification
}
