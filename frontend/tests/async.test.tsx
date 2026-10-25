import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { type AsyncState, useAsync } from '../src/hooks/useAsync'

const pause = () => new Promise((resolve) => setTimeout(resolve, 15))

test('disabled requests wait; failures clear on a new key; stale responses cannot overwrite', async () => {
  const dom = new JSDOM('<div id="root"></div>')
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(document.getElementById('root')!)
  let state: AsyncState<string>
  let calls = 0
  let signal: AbortSignal | undefined
  let resolveOld: (value: string) => void = () => {}
  function Probe({ requestKey }: { requestKey: string | null }) {
    const result = useAsync((s) => {
      calls++
      signal = s
      if (requestKey === 'failure') return Promise.reject(new Error('offline'))
      if (requestKey === 'old') return new Promise((resolve) => { resolveOld = resolve })
      return Promise.resolve('loaded')
    }, requestKey, requestKey === 'new' ? 40 : 0)
    useEffect(() => { state = result })
    return null
  }
  try {
    await act(async () => { root.render(createElement(Probe, { requestKey: null })) })
    await act(pause)
    assert.equal(calls, 0, 'prerequisites must suppress the request')
    assert.equal(state!.loading, false)
    await act(async () => { root.render(createElement(Probe, { requestKey: 'failure' })) })
    await act(pause)
    assert.equal(state!.error?.message, 'offline')
    await act(async () => { root.render(createElement(Probe, { requestKey: 'old' })) })
    assert.equal(state!.error, undefined, 'a previous key error must not mask the retry')
    await act(pause)
    const oldSignal = signal!
    await act(async () => { root.render(createElement(Probe, { requestKey: 'new' })) })
    assert.equal(oldSignal.aborted, true)
    await act(async () => { resolveOld('stale') })
    await act(async () => { await new Promise((r) => setTimeout(r, 60)) })
    assert.equal(state!.data, 'loaded')
    assert.equal(state!.loading, false)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
  }
})
