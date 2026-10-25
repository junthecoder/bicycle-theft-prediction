import assert from 'node:assert/strict'
import { test } from 'node:test'
import { overlayInsets } from '../src/hooks/useOverlayInsets'
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

test('overlay insets never go negative while the viewport is still tiny', () => {
  // An 8px-wide window with the side panel at its 12px margin crashed MapLibre with negative padding.
  assert.deepEqual(overlayInsets(8, 8, { top: 12, left: 12, bottom: 40 }, { top: -30, left: 12, bottom: -4 }), {
    top: 40,
    right: 0,
    bottom: 0,
  })
  assert.deepEqual(overlayInsets(1024, 768, { top: 12, left: 12, bottom: 250 }, { top: 12, left: 652, bottom: 756 }), {
    top: 250,
    right: 372,
    bottom: 0,
  })
  assert.deepEqual(overlayInsets(400, 800, undefined, { top: 500, left: 12, bottom: 788 }), {
    top: 0,
    right: 0,
    bottom: 300,
  })
})
