import assert from 'node:assert/strict'
import { test } from 'node:test'
import { focusOptions, formatValue } from '../src/lib/mapDisplay'

test('zero-incident areas below the rate threshold do not show a numeric rate', () => {
  assert.equal(formatValue(undefined, 'rate', 50, 100), '—')
  assert.equal(formatValue(undefined, 'rate', 100, 100), '0.0')
  assert.equal(formatValue(undefined, 'count', 50, 100), '0件')
})

test('focusing an area respects panels without overwriting persistent map padding', () => {
  const options = focusOptions({ top: 250, right: 372, bottom: 0 })
  assert.deepEqual(options.padding, { top: 274, right: 396, bottom: 24, left: 24 })
  assert.equal((options as { retainPadding?: boolean }).retainPadding, false)
})
