import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import SidePanel from '../src/components/SidePanel'
import { Bars } from '../src/components/Charts'

async function mount() {
  const dom = new JSDOM('<div id="root"></div>')
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(document.getElementById('root')!)
  return { dom, root }
}

test('ranking suppresses comparisons whose previous window is outside coverage', async () => {
  const { dom, root } = await mount()
  const props = {
    summary: undefined, loading: false, dateMin: '2018-01-01', unrecordedAreas: new Set<string>(),
    period: { end: '2018-01-02', days: 7, hourFrom: 0, hourSpan: 24 }, metric: 'count' as const, domainMax: 5,
    areas: [{ key_code: 'a', ward: '東区', name: '箱崎' }] as never,
    values: new Map([['a', { count: 5, prevCount: 0, rate: 1 }]]), selectedKey: null,
    onSelectArea: () => {}, onPickHour: () => {},
  }
  try {
    await act(async () => root.render(createElement(SidePanel, props)))
    await act(async () => { (document.querySelectorAll('[role=tab]')[1] as HTMLElement).click() })
    assert.equal(document.querySelector('td:last-child')?.textContent, '—')
    await act(async () => root.render(createElement(SidePanel, { ...props, period: { ...props.period, end: '2018-02-01' } })))
    assert.match(document.querySelector('td:last-child')!.textContent!, /▲5/)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
  }
})

test('interactive hour bars support keyboard activation', async () => {
  const { dom, root } = await mount()
  const picked: number[] = []
  try {
    await act(async () => root.render(createElement(Bars, { values: [2, 3], labels: ['0', '1'], onClick: (i) => picked.push(i) })))
    const bar = document.querySelector('[role=button]') as HTMLElement
    assert.equal(bar.tabIndex, 0)
    for (const key of ['Enter', ' ']) {
      await act(async () => { bar.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })) })
    }
    assert.deepEqual(picked, [0, 0])
    assert.ok(bar.getAttribute('aria-label'))
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
  }
})
