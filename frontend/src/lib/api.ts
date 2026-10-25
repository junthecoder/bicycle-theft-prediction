import type { AreaCounts, AreaFeatureCollection, Meta, Summary, Timeline } from '../client'
import { getAreaCounts, getAreas, getMeta, getSummary, getTimeline } from '../client'
import { hourRange, type Period } from './period'

// Thin wrappers over the generated SDK: throw on HTTP errors and return the payload directly.

function windowQuery(period: Period) {
  const { hourFrom, hourTo } = hourRange(period)
  return { end: period.end, days: period.days, hour_from: hourFrom, hour_to: hourTo }
}

export async function fetchMeta(signal?: AbortSignal): Promise<Meta> {
  const { data } = await getMeta({ signal, throwOnError: true })
  return data
}

export async function fetchAreas(signal?: AbortSignal): Promise<AreaFeatureCollection> {
  const { data } = await getAreas({ signal, throwOnError: true })
  return data
}

export async function fetchAreaCounts(period: Period, signal?: AbortSignal): Promise<AreaCounts> {
  const { data } = await getAreaCounts({ query: windowQuery(period), signal, throwOnError: true })
  return data
}

export async function fetchSummary(period: Period, keyCode: string | null, signal?: AbortSignal): Promise<Summary> {
  const { data } = await getSummary({
    query: { ...windowQuery(period), key_code: keyCode ?? undefined },
    signal,
    throwOnError: true,
  })
  return data
}

export async function fetchTimeline(period: Period, keyCode: string | null, signal?: AbortSignal): Promise<Timeline> {
  const { hourFrom, hourTo } = hourRange(period)
  const { data } = await getTimeline({
    query: { hour_from: hourFrom, hour_to: hourTo, key_code: keyCode ?? undefined },
    signal,
    throwOnError: true,
  })
  return data
}
