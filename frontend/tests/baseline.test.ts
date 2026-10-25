import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDays, daysBetween } from '../src/lib/date'
import { hourRange, isHourSelected, periodFromThumbs, windowDays } from '../src/lib/period'
import { colorFor, NA_COLOR, robustMax } from '../src/lib/color'

test('calendar windows and wrapped hour bands agree with the API contract', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29')
  assert.equal(daysBetween('2025-03-08', '2025-03-10'), 2)
  const period = { end: '2025-03-01', days: 'all' as const, ...periodFromThumbs(22, 6) }
  assert.equal(windowDays(period, '2025-01-01'), 60)
  assert.deepEqual(hourRange(period), { hourFrom: 22, hourTo: 5 })
  for (let hour = 0; hour < 24; hour++) assert.equal(isHourSelected(period, hour), hour >= 22 || hour <= 5)
})

test('color scale handles empty data and null rates', () => {
  assert.equal(robustMax([], 5), 5)
  assert.equal(colorFor(null, 5), NA_COLOR)
})
