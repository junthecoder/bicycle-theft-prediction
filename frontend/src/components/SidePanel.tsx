import { useMemo, useState } from 'react'
import type { AreaProperties, Summary } from '../client'
import { colorFor } from '../lib/color'
import { WEEKDAY_LABELS } from '../lib/date'
import { isHourSelected, METRIC_LABELS, type Metric, type Period } from '../lib/period'
import type { AreaValue } from '../Map'
import { Bars, CategoryList } from './Charts'

type Tab = 'summary' | 'ranking' | 'search'

interface Props {
  summary: Summary | undefined
  loading: boolean
  period: Period
  metric: Metric
  domainMax: number
  areas: AreaProperties[]
  values: Map<string, AreaValue>
  selectedKey: string | null
  onSelectArea: (keyCode: string | null, zoom: boolean) => void
  onPickHour: (hour: number) => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: '概要' },
  { id: 'ranking', label: 'ランキング' },
  { id: 'search', label: '地域を探す' },
]
// Monday-first order coming from the API, mapped onto the Sunday-first weekday labels.
const WEEKDAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0]
const RANKING_SIZE = 20
const SEARCH_LIMIT = 30

function percent(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '—'
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous
  if (diff === 0) return <span className="delta">±0</span>
  const sign = diff > 0 ? '▲' : '▼'
  const pct = previous > 0 ? ` (${Math.round((Math.abs(diff) / previous) * 100)}%)` : ''
  return (
    <span className={`delta ${diff > 0 ? 'up' : 'down'}`}>
      {sign}
      {Math.abs(diff)}
      {pct}
    </span>
  )
}

/** Peak hour band: the three consecutive hours with the most thefts. */
function peakHours(byHour: number[]): { from: number; count: number } | null {
  const total = byHour.reduce((a, b) => a + b, 0)
  if (total === 0) return null
  let best = { from: 0, count: -1 }
  for (let h = 0; h < 24; h++) {
    const count = byHour[h] + byHour[(h + 1) % 24] + byHour[(h + 2) % 24]
    if (count > best.count) best = { from: h, count }
  }
  return best
}

function Insights({ summary }: { summary: Summary }) {
  const items: string[] = []
  const peak = peakHours(summary.by_hour)
  const knownHours = summary.total - summary.unknown_hour
  if (peak && knownHours > 0) {
    items.push(
      `被害が集中する時間帯は${peak.from}時〜${(peak.from + 3) % 24}時（${percent(peak.count, knownHours)}）。この時間帯の見回りや、駐輪場所の見直しが有効です。`,
    )
  }
  const lockKnown = summary.locked + summary.unlocked
  if (lockKnown > 0) {
    const unlockedPct = Math.round((summary.unlocked / lockKnown) * 100)
    items.push(
      unlockedPct >= 50
        ? `${unlockedPct}%が無施錠での被害です。短時間でも必ず施錠し、ワイヤーロックで二重に固定しましょう。`
        : `施錠していても${100 - unlockedPct}%が被害に遭っています。固定物につなぐ二重ロックが有効です。`,
    )
  }
  if (summary.total > 0) {
    items.push(`${percent(summary.bicycle_parking, summary.total)}は駐輪場での被害です。集合住宅や商業施設の駐輪場が主な現場です。`)
  }
  if (summary.prev_total > 0 && summary.total >= summary.prev_total * 1.3 && summary.total >= 5) {
    items.push('直前の同じ長さの期間より3割以上増えています。重点的な警戒が必要です。')
  }
  if (items.length === 0) return null
  return (
    <ul className="insights">
      {items.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  )
}

function SummaryTab({
  summary,
  period,
  onPickHour,
  onSelectArea,
}: Pick<Props, 'summary' | 'period' | 'onPickHour' | 'onSelectArea'>) {
  if (!summary) return <div className="notice">読み込み中…</div>
  const weekdayValues = WEEKDAYS_MON_FIRST.map((_, i) => summary.by_weekday[i])
  const weekdayLabels = WEEKDAYS_MON_FIRST.map((d) => WEEKDAY_LABELS[d])
  const lockKnown = summary.locked + summary.unlocked
  return (
    <>
      <div className="area-title">
        <div style={{ flex: 1 }}>
          <h2>
            {summary.ward && <span className="ward">{summary.ward}</span>}
            {summary.name}
          </h2>
          <div className="meta">人口 {summary.population.toLocaleString()}人</div>
        </div>
        {summary.key_code && (
          <button type="button" className="link-button" onClick={() => onSelectArea(null, false)}>
            全域に戻る
          </button>
        )}
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="label">件数</div>
          <div className="value">
            {summary.total}
            <small>件</small>
          </div>
        </div>
        <div className="kpi">
          <div className="label">前期間比</div>
          <div className="value" style={{ fontSize: 16 }}>
            <Delta current={summary.total} previous={summary.prev_total} />
          </div>
          <div className="label">前期間 {summary.prev_total}件</div>
        </div>
        <div className="kpi">
          <div className="label">千人あたり</div>
          <div className="value">
            {summary.rate === null ? '—' : summary.rate.toFixed(1)}
            <small>件</small>
          </div>
        </div>
      </div>

      <Insights summary={summary} />

      <div className="section">
        <h3>
          時間帯別 <span>クリックでその時間に絞り込み{summary.unknown_hour > 0 && `・時刻不明 ${summary.unknown_hour}件`}</span>
        </h3>
        <Bars
          values={summary.by_hour}
          labels={Array.from({ length: 24 }, (_, h) => (h % 3 === 0 ? String(h) : ''))}
          selected={(h) => isHourSelected(period, h)}
          onClick={onPickHour}
          title={(h) => `${h}時台: ${summary.by_hour[h]}件`}
        />
      </div>

      <div className="section">
        <h3>曜日別</h3>
        <Bars
          values={weekdayValues}
          labels={weekdayLabels}
          labelClass={(i) => (WEEKDAYS_MON_FIRST[i] === 6 ? 'saturday' : WEEKDAYS_MON_FIRST[i] === 0 ? 'holiday' : '')}
          title={(i) => `${weekdayLabels[i]}曜: ${weekdayValues[i]}件`}
        />
      </div>

      <div className="section">
        <h3>
          施錠の有無 <span>{lockKnown}件中</span>
        </h3>
        <div className="stacked">
          <div className="unlocked" style={{ width: percent(summary.unlocked, lockKnown) }} title="無施錠" />
          <div className="locked" style={{ width: percent(summary.locked, lockKnown) }} title="施錠あり" />
        </div>
        <div className="stacked-legend">
          <span>
            無施錠 {summary.unlocked}件 ({percent(summary.unlocked, lockKnown)})
          </span>
          <span>
            施錠あり {summary.locked}件 ({percent(summary.locked, lockKnown)})
          </span>
        </div>
      </div>

      <div className="section">
        <h3>発生場所</h3>
        <CategoryList items={summary.by_place} total={summary.total} />
      </div>

      <div className="section">
        <h3>被害者の年齢</h3>
        <CategoryList items={summary.by_age} total={summary.total} />
      </div>

      <div className="section">
        <h3>
          管轄交番・駐在所 <span>件数の多い順</span>
        </h3>
        <CategoryList items={summary.top_koban} total={summary.total} />
      </div>
    </>
  )
}

function RankingTab({
  areas,
  values,
  metric,
  domainMax,
  selectedKey,
  onSelectArea,
}: Pick<Props, 'areas' | 'values' | 'metric' | 'domainMax' | 'selectedKey' | 'onSelectArea'>) {
  const byKey = useMemo(() => new Map(areas.map((a) => [a.key_code, a])), [areas])
  const rows = useMemo(() => {
    const list = [...values.entries()]
      .map(([key, value]) => ({ key, value, area: byKey.get(key) }))
      .filter((row) => row.area && row.value.count > 0)
    if (metric === 'rate') {
      return list
        .filter((row) => row.value.rate !== null)
        .sort((a, b) => (b.value.rate ?? 0) - (a.value.rate ?? 0))
        .slice(0, RANKING_SIZE)
    }
    return list.sort((a, b) => b.value.count - a.value.count).slice(0, RANKING_SIZE)
  }, [values, byKey, metric])

  if (rows.length === 0) return <div className="notice">この期間・時間帯の記録はありません</div>
  return (
    <div className="section">
      <h3>
        {METRIC_LABELS[metric]}の多い町丁目 <span>上位{rows.length}</span>
      </h3>
      <table className="ranking">
        <thead>
          <tr>
            <th>#</th>
            <th>町丁目</th>
            <th className="num">{metric === 'count' ? '件数' : '件/千人'}</th>
            <th className="num">前期間比</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const shown = metric === 'count' ? row.value.count : (row.value.rate ?? 0)
            return (
              <tr
                key={row.key}
                className={`row${selectedKey === row.key ? ' selected' : ''}`}
                onClick={() => onSelectArea(row.key, true)}
              >
                <td className="num">{i + 1}</td>
                <td className="name">
                  <span className="swatch" style={{ background: colorFor(shown, domainMax), display: 'inline-block', verticalAlign: -2, marginRight: 6 }} />
                  <span className="ward">{row.area?.ward}</span>
                  {row.area?.name}
                </td>
                <td className="num">
                  {metric === 'count' ? row.value.count : shown.toFixed(1)}
                  {metric === 'rate' && <span style={{ color: 'var(--muted)' }}> ({row.value.count}件)</span>}
                </td>
                <td className="num">
                  <Delta current={row.value.count} previous={row.value.prevCount} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SearchTab({ areas, values, onSelectArea }: Pick<Props, 'areas' | 'values' | 'onSelectArea'>) {
  const [query, setQuery] = useState('')
  const normalized = query.normalize('NFKC').trim()
  const results = useMemo(() => {
    if (!normalized) return []
    return areas
      .filter((a) => a.name.includes(normalized) || a.name_normalized.includes(normalized) || a.ward.includes(normalized))
      .slice(0, SEARCH_LIMIT)
  }, [areas, normalized])
  return (
    <>
      <input
        className="search-input"
        type="search"
        placeholder="町丁目名で検索（例: 箱崎1丁目、天神）"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {normalized && results.length === 0 && <div className="notice">見つかりませんでした</div>}
      <ul className="search-results">
        {results.map((area) => (
          <li key={area.key_code}>
            <button type="button" onClick={() => onSelectArea(area.key_code, true)}>
              <span>
                <span className="ward">{area.ward}</span>
                {area.name}
              </span>
              <span className="count">{values.get(area.key_code)?.count ?? 0}件</span>
            </button>
          </li>
        ))}
      </ul>
      {!normalized && (
        <div className="notice">
          自宅や職場、通学先の町丁目を探して、被害の多い時間帯や施錠状況を確認できます。地図上の地域をクリックしても同じ情報が見られます。
        </div>
      )}
    </>
  )
}

function SidePanel(props: Props) {
  const [tab, setTab] = useState<Tab>('summary')
  return (
    <div className="panel side">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'summary' && props.loading && <span className="loading-dot" />}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {tab === 'summary' && <SummaryTab {...props} />}
        {tab === 'ranking' && <RankingTab {...props} />}
        {tab === 'search' && <SearchTab {...props} />}
      </div>
    </div>
  )
}

export default SidePanel
