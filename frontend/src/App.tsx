import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Legend from './components/Legend'
import SidePanel from './components/SidePanel'
import TimeControls from './components/TimeControls'
import { useAsync } from './hooks/useAsync'
import { fetchAreaCounts, fetchAreas, fetchMeta, fetchSummary, fetchTimeline } from './lib/api'
import { robustMax } from './lib/color'
import { addDays } from './lib/date'
import { type Metric, type Period, periodKey } from './lib/period'
import MapView, { type AreaValue } from './Map'

const DEFAULT_DAYS = 90
// Slider drags update the label immediately but wait this long before hitting the API.
const FETCH_DELAY_MS = 120
const PLAY_INTERVAL_MS = 250

function App() {
  const meta = useAsync(fetchMeta, 'meta')
  const areas = useAsync(fetchAreas, 'areas')

  // Until the user touches the controls, the period is derived from the data's last date.
  const [chosenPeriod, setPeriod] = useState<Period | null>(null)
  const dateMin = meta.data?.date_min
  const dateMax = meta.data?.date_max
  const period = useMemo<Period | null>(
    () => chosenPeriod ?? (dateMax ? { end: dateMax, days: DEFAULT_DAYS, hourFrom: 0, hourSpan: 24 } : null),
    [chosenPeriod, dateMax],
  )
  const [metric, setMetric] = useState<Metric>('count')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ keyCode: string; nonce: number } | null>(null)
  const [lockedMax, setLockedMax] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)

  // Playback: step the end date forward until the data runs out.
  useEffect(() => {
    if (!playing || !period || !meta.data) return
    const dateMax = meta.data.date_max
    const step = period.days !== 'all' && period.days <= 7 ? 1 : 7
    const timer = setInterval(() => {
      setPeriod((current) => {
        const base = current ?? period
        const next = addDays(base.end, step)
        if (next >= dateMax) setPlaying(false)
        return { ...base, end: next > dateMax ? dateMax : next }
      })
    }, PLAY_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [playing, period, meta.data])

  const key = period ? periodKey(period) : ''
  const noPeriod = () => Promise.reject(new Error('no period'))
  const counts = useAsync((signal) => (period && dateMin ? fetchAreaCounts(period, dateMin, signal) : noPeriod()), key, FETCH_DELAY_MS)
  const summary = useAsync(
    (signal) => (period && dateMin ? fetchSummary(period, dateMin, selectedKey, signal) : noPeriod()),
    `${key}|${selectedKey ?? ''}`,
    FETCH_DELAY_MS,
  )
  const timeline = useAsync(
    (signal) => (period ? fetchTimeline(period, null, signal) : noPeriod()),
    period ? `${period.hourFrom}|${period.hourSpan}` : '',
    FETCH_DELAY_MS,
  )

  const values = useMemo(() => {
    const map = new Map<string, AreaValue>()
    for (const area of counts.data?.areas ?? []) {
      map.set(area.key_code, { count: area.count, prevCount: area.prev_count, rate: area.rate })
    }
    return map
  }, [counts.data])

  const computedMax = useMemo(() => {
    const list = [...values.values()]
    return metric === 'count'
      ? robustMax(list.map((v) => v.count), 5)
      : robustMax(list.flatMap((v) => (v.rate === null ? [] : [v.rate])), 2)
  }, [values, metric])
  const domainMax = lockedMax ?? computedMax

  const areaProperties = useMemo(() => areas.data?.features.map((f) => f.properties) ?? [], [areas.data])

  const selectArea = (keyCode: string | null, zoom: boolean) => {
    setSelectedKey(keyCode)
    if (keyCode && zoom) setFocus((f) => ({ keyCode, nonce: (f?.nonce ?? 0) + 1 }))
  }

  const onMetric = (next: Metric) => {
    setMetric(next)
    setLockedMax(null) // the scale of one metric is meaningless for the other
  }

  const error = meta.error ?? areas.error ?? counts.error
  if (error) {
    return (
      <div className="status">
        <div className="error">
          <p>データを読み込めませんでした。</p>
          <p>backend/ で `uv run api` が起動しているか確認してください。</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>{error.message}</p>
        </div>
      </div>
    )
  }
  if (!meta.data || !period) {
    return <div className="status">読み込み中…</div>
  }

  return (
    <div className="app">
      <div className="map-container">
        <MapView
          areas={areas.data}
          values={values}
          metric={metric}
          domainMax={domainMax}
          minPopulationForRate={meta.data.min_population_for_rate}
          selectedKey={selectedKey}
          onSelect={(keyCode) => selectArea(keyCode, false)}
          focus={focus}
        />
      </div>

      <div className="overlay top-left">
        <div className="panel">
          <div className="header">
            <h1>福岡市 自転車盗マップ</h1>
            <span className="subtitle">町丁目別の発生状況</span>
          </div>
          <TimeControls
            dateMin={meta.data.date_min}
            dateMax={meta.data.date_max}
            period={period}
            onChange={(next) => {
              setPlaying(false)
              setPeriod(next)
            }}
            timeline={timeline.data?.points}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
          />
        </div>
      </div>

      <div className="overlay bottom-left">
        <Legend
          metric={metric}
          onMetric={onMetric}
          domainMax={domainMax}
          locked={lockedMax !== null}
          onLocked={(locked) => setLockedMax(locked ? computedMax : null)}
          minPopulationForRate={meta.data.min_population_for_rate}
          populationYear={meta.data.population_year}
          unmapped={counts.data?.unmapped ?? 0}
        />
      </div>

      <div className="overlay right">
        <SidePanel
          summary={summary.data}
          loading={summary.loading || counts.loading}
          dateMin={meta.data.date_min}
          period={period}
          metric={metric}
          domainMax={domainMax}
          areas={areaProperties}
          values={values}
          selectedKey={selectedKey}
          onSelectArea={selectArea}
          onPickHour={(hour) => {
            setPlaying(false)
            setPeriod({ ...period, hourFrom: hour, hourSpan: 1 })
          }}
        />
      </div>
    </div>
  )
}

export default App
