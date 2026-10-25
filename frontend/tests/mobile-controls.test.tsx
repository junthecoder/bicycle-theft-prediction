import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import TimeControls from '../src/components/TimeControls'

test('time panel provides a metric selector when the floating legend is hidden on mobile', async () => {
  const dom = new JSDOM('<div id="root"></div>')
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(document.getElementById('root')!)
  let metric = ''
  const props = { dateMin: '2025-01-01', dateMax: '2025-01-02', period: { end: '2025-01-02', days: 1, hourFrom: 0, hourSpan: 24 },
    onChange: () => {}, timeline: undefined, playing: false, onTogglePlay: () => {}, metric: 'count' as const, onMetric: (value: string) => { metric = value } }
  try {
    await act(async () => root.render(createElement(TimeControls, props)))
    const selector = document.querySelector('.mobile-metric-selector')
    assert.ok(selector, 'mobile must retain a way to change between count and per-capita rates')
    const rate = [...selector.querySelectorAll('[role=radio]')].find((button) => button.textContent === '人口千人あたり') as HTMLElement
    assert.ok(rate)
    await act(async () => rate.click())
    assert.equal(metric, 'rate')
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
  }
})
