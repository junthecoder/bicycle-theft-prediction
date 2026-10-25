import type { AreaCounts, AreaFeatureCollection, CityOutlineFeatureCollection, Meta, Summary, Timeline } from '../client'
import { getAreaCounts, getAreas, getCityOutline, getMeta, getSummary, getTimeline } from '../client'
import { hourRange, type Period, windowDays } from './period'

// Thin wrappers over the generated SDK: throw on HTTP errors and return the payload directly.
// `dateMin` (from /api/meta) resolves the 全期間 window into a day count.

function windowQuery(period: Period, dateMin: string) {
  const { hourFrom, hourTo } = hourRange(period)
  return { end: period.end, days: windowDays(period, dateMin), hour_from: hourFrom, hour_to: hourTo }
}

export async function fetchMeta(signal?: AbortSignal): Promise<Meta> {
  const { data } = await getMeta({ signal, throwOnError: true })
  return data
}

export async function fetchAreas(signal?: AbortSignal): Promise<AreaFeatureCollection> {
  const { data } = await getAreas({ signal, throwOnError: true })
  return data
}

export async function fetchCityOutline(signal?: AbortSignal): Promise<CityOutlineFeatureCollection> {
  const { data } = await getCityOutline({ signal, throwOnError: true })
  return data
}

export async function fetchAreaCounts(period: Period, dateMin: string, signal?: AbortSignal): Promise<AreaCounts> {
  const { data } = await getAreaCounts({ query: windowQuery(period, dateMin), signal, throwOnError: true })
  return data
}

export async function fetchSummary(
  period: Period,
  dateMin: string,
  keyCode: string | null,
  signal?: AbortSignal,
): Promise<Summary> {
  const { data } = await getSummary({
    query: { ...windowQuery(period, dateMin), key_code: keyCode ?? undefined },
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
