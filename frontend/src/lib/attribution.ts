// Credits shown in MapLibre's attribution control. The police and e-Stat terms (政府標準利用規約
// 2.0) ask for the source and, as a separate statement, that it was processed; the full list of
// resource URLs, licences and the disclaimer lives on public/credits.html.

const link = (href: string, text: string, className?: string) =>
  `<a href="${href}" target="_blank" rel="noopener"${className ? ` class="${className}"` : ''}>${text}</a>`
const nowrap = (html: string) => `<span class="nowrap">${html}</span>`
const SEPARATOR = '<span class="separator"> | </span>'

export const POLICE_OPEN_DATA_URL = 'https://www.police.pref.fukuoka.jp/somu/koho/opendata.html'
export const E_STAT_URL = 'https://www.e-stat.go.jp/'
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright'

/**
 * Replaces the attribution that @protomaps/basemaps writes into the style, so that the OSM credit
 * says "contributors". MapLibre drops any attribution that is a substring of another one, and this
 * string appears verbatim in attributionHtml(), so the control shows only that, in our order.
 */
export const BASEMAP_ATTRIBUTION =
  `${link('https://github.com/protomaps/basemaps', 'Protomaps')} ` + link(OSM_COPYRIGHT_URL, '© OpenStreetMap contributors')

/**
 * One string rather than a customAttribution array: MapLibre sorts array entries by length, which
 * would put the processing statement before the sources it refers to.
 */
export function attributionHtml(baseUrl: string): string {
  const credits = `${baseUrl}credits.html`
  return [
    `出典：${nowrap(`${link(`${credits}#thefts`, '「自転車盗（CSVファイル）」')}（${link(POLICE_OPEN_DATA_URL, '福岡県警察')}）`)}`,
    `、${nowrap(link(E_STAT_URL, '政府統計の総合窓口(e-Stat)'))}。`,
    `${nowrap('これらを加工して作成')}・${nowrap('<span class="unofficial">非公式</span>')}`,
    SEPARATOR,
    nowrap(link(credits, '出典・免責の詳細', 'credits')),
    SEPARATOR,
    nowrap(BASEMAP_ATTRIBUTION),
    SEPARATOR,
    link('https://maplibre.org/', 'MapLibre'),
  ].join('')
}
