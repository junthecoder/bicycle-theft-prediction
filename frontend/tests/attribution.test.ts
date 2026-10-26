import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { attributionHtml, BASEMAP_ATTRIBUTION, OSM_COPYRIGHT_URL } from '../src/lib/attribution'

const html = attributionHtml('/')
const credits = readFileSync(new URL('../public/credits.html', import.meta.url), 'utf8')

test('attribution names each source and states the processing separately, after them', () => {
  const text = new JSDOM(html).window.document.body.textContent ?? ''
  assert.match(text, /^出典：「自転車盗（CSVファイル）」（福岡県警察）、政府統計の総合窓口\(e-Stat\)。/)
  assert.ok(text.indexOf('これらを加工して作成') > text.indexOf('政府統計の総合窓口(e-Stat)'))
  assert.ok(text.includes('非公式'))
  assert.ok(text.includes('© OpenStreetMap contributors'))
})

test('the style credit is a substring of the attribution, so MapLibre drops the duplicate', () => {
  // AttributionControl removes any entry contained in a longer one.
  assert.ok(html.includes(BASEMAP_ATTRIBUTION))
  assert.ok(BASEMAP_ATTRIBUTION.includes(`href="${OSM_COPYRIGHT_URL}"`))
})

test('attribution markup survives MapLibre sanitizing', () => {
  // Allow lists from maplibre-gl src/util/dom.ts; anything else is stripped from the control.
  const tags = new Set(['a', 'span'])
  const attributes = new Set(['href', 'target', 'rel', 'class'])
  const body = new JSDOM(html).window.document.body
  for (const element of body.querySelectorAll('*')) {
    assert.ok(tags.has(element.localName), element.localName)
    for (const name of element.getAttributeNames()) assert.ok(attributes.has(name), name)
  }
})

test('credit links follow the base path and land on the credits page sections', () => {
  const links = [...new JSDOM(attributionHtml('/app/')).window.document.querySelectorAll('a')].map((a) => a.getAttribute('href'))
  assert.ok(links.includes('/app/credits.html'))
  assert.ok(links.includes('/app/credits.html#thefts'))
  assert.match(credits, /id="thefts"/)
})

test('the credits page lists every yearly theft resource and the disclaimer', () => {
  for (const year of [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]) {
    assert.match(credits, new RegExp(`/download/fukuoka_${year}zit[a-z]+\\.csv`), `${year}`)
  }
  assert.ok(credits.includes('非公式'))
  assert.ok(credits.includes('を加工して作成'))
})
