import { useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: Error | undefined
}

interface Settled<T> {
  key: string
  data: T | undefined
  error: Error | undefined
}

/**
 * Run `load` whenever `key` changes, after `delayMs` of quiet (so dragging a slider doesn't fire a
 * request per pixel). Stale requests are aborted and the previous data is kept while reloading.
 */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, key: string | null, delayMs = 0): AsyncState<T> {
  const loadRef = useRef(load)
  const [settled, setSettled] = useState<Settled<T>>({ key: '', data: undefined, error: undefined })

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      Promise.resolve().then(() => loadRef.current(controller.signal)).then(
        (data) => {
          if (!controller.signal.aborted) setSettled({ key, data, error: undefined })
        },
        (error: unknown) => {
          if (controller.signal.aborted) return
          const wrapped = error instanceof Error ? error : new Error(String(error))
          setSettled((s) => ({ key, data: s.data, error: wrapped }))
        },
      )
    }, delayMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, delayMs])

  // Loading is derived: the last settled result belongs to a different key than the current one.
  return { data: settled.data, error: settled.key === key ? settled.error : undefined, loading: key !== null && settled.key !== key }
}
