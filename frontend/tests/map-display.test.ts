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
  const options = focusOptions({ top: 250, right: 372, bottom: 0, footer: 0 })
  assert.deepEqual(options.padding, { top: 274, right: 396, bottom: 24, left: 24 })
  assert.equal((options as { retainPadding?: boolean }).retainPadding, false)
})

test('overlay insets never go negative while the viewport is still tiny', () => {
  // An 8px-wide window with the side panel at its 12px margin crashed MapLibre with negative padding.
  assert.deepEqual(overlayInsets(8, 8, { top: 12, left: 12, bottom: 40 }, { top: -30, left: 12, bottom: -4 }), {
    top: 40,
    right: 0,
    bottom: 0,
    footer: 0,
  })
  assert.deepEqual(overlayInsets(1024, 768, { top: 12, left: 12, bottom: 250 }, { top: 12, left: 652, bottom: 756 }), {
    top: 250,
    right: 372,
    bottom: 0,
    footer: 0,
  })
  assert.deepEqual(overlayInsets(400, 800, undefined, { top: 500, left: 12, bottom: 788 }), {
    top: 0,
    right: 0,
    bottom: 300,
    footer: 0,
  })
})

test('the attribution footer pads the bottom of the map unless the bottom sheet already covers more', () => {
  // Desktop: the side panel is on the right, so only the footer covers the bottom edge.
  assert.deepEqual(
    overlayInsets(1440, 900, { top: 12, left: 12, bottom: 402 }, { top: 12, left: 1068, bottom: 888 }, { top: 876, height: 24 }),
    { top: 402, right: 372, bottom: 24, footer: 24 },
  )
  // Phone: the sheet sits on top of the footer and reaches further up.
  assert.deepEqual(
    overlayInsets(390, 844, { top: 12, left: 12, bottom: 440 }, { top: 478, left: 12, bottom: 790 }, { top: 790, height: 54 }),
    { top: 440, right: 0, bottom: 366, footer: 54 },
  )
})
