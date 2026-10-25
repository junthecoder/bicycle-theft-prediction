import type { FeatureCollection, Geometry } from 'geojson'
import { addProtocol, setWorkerUrl, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre 6 locates its worker relative to import.meta.url at runtime, which a bundled build
// can't satisfy; let Vite bundle the worker and hand MapLibre the resulting URL.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { Protocol } from 'pmtiles'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapGL, {
  Layer,
  NavigationControl,
  Popup,
  ScaleControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
  type MapSourceDataEvent,
} from 'react-map-gl/maplibre'
import baseStyle from './basemap-style.json'
import type { AreaFeatureCollection, AreaProperties, CityOutlineFeatureCollection } from './client'
import type { OverlayInsets } from './hooks/useOverlayInsets'
import { fillColorExpression } from './lib/color'
import { METRIC_LABELS, type Metric } from './lib/period'

// The generated style points its source at pmtiles:///tiles/fukuoka.pmtiles, which the Vite dev
// server proxies to the backend; the protocol handler turns tile requests into range requests.
setWorkerUrl(maplibreWorkerUrl)
addProtocol('pmtiles', new Protocol().tile)

type Bounds = [number, number, number, number]

const style = baseStyle as unknown as StyleSpecification
// Draw the choropleth under the basemap's text so place names stay legible.
const FIRST_SYMBOL_LAYER = style.layers.find((layer) => layer.type === 'symbol')?.id
const AREAS_SOURCE = 'areas'
const CITY_SOURCE = 'city'
// Extent of the city proper: the mainland, 志賀島 and 玄界島. 小呂島 lies another 20 km out to sea
// (130.03, 33.87) and would push the pannable area far to the west, so it is left out.
const CITY_EXTENT: Bounds = [130.198, 33.426, 130.495, 33.713]
// Pannable margin around the city, the same distance on every side. Keep it below MARGIN_KM in
// backend download_pmtiles.py so the basemap extract covers everything the map can show.
const VIEW_MARGIN_KM = 8
const KM_PER_DEGREE_LAT = 111.32
function padBounds([west, south, east, north]: Bounds, km: number): Bounds {
  const dLat = km / KM_PER_DEGREE_LAT
  const dLng = dLat / Math.cos(((south + north) / 2) * (Math.PI / 180))
  return [west - dLng, south - dLat, east + dLng, north + dLat]
}

const MAX_BOUNDS = padBounds(CITY_EXTENT, VIEW_MARGIN_KM)
// Web Mercator: the world is 512 px wide at zoom 0.
const EARTH_CIRCUMFERENCE_M = 40_075_016.686
const WORLD_PX_AT_ZOOM_0 = 512

function metersPerPixel(latitude: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos(latitude * (Math.PI / 180))) / (WORLD_PX_AT_ZOOM_0 * 2 ** zoom)
}

export interface AreaValue {
  count: number
  prevCount: number
  rate: number | null
}

interface Props {
  areas: AreaFeatureCollection | undefined
  cityOutline: CityOutlineFeatureCollection | undefined
  /** KEY_CODEs the police never file thefts under; drawn dark grey instead of by value. */
  unrecordedAreas: Set<string>
  /** Screen space covered by the overlay panels (useOverlayInsets). */
  insets: OverlayInsets
  values: Map<string, AreaValue>
  metric: Metric
  domainMax: number
  minPopulationForRate: number
  selectedKey: string | null
  onSelect: (keyCode: string | null) => void
  /** Bump `nonce` to zoom to the area again even if `keyCode` is unchanged. */
  focus: { keyCode: string; nonce: number } | null
}

interface Hover {
  properties: AreaProperties
  longitude: number
  latitude: number
}

function geometryBounds(geometry: Geometry): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === 'number') {
      const [x, y] = coords as [number, number]
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    } else {
      for (const child of coords) visit(child)
    }
  }
  if ('coordinates' in geometry) visit(geometry.coordinates)
  return [minX, minY, maxX, maxY]
}

function formatValue(value: AreaValue | undefined, metric: Metric): string {
  if (metric === 'count') return `${value?.count ?? 0}件`
  if (!value) return '0'
  return value.rate === null ? '—' : value.rate.toFixed(1)
}

function MapView({
  areas,
  cityOutline,
  unrecordedAreas,
  insets,
  values,
  metric,
  domainMax,
  minPopulationForRate,
  selectedKey,
  onSelect,
  focus,
}: Props) {
  const mapRef = useRef<MapRef>(null)
  const [sourceReady, setSourceReady] = useState(false)
  const [hover, setHover] = useState<Hover | null>(null)
  const hoveredKeyRef = useRef<string | null>(null)
  const selectedKeyRef = useRef<string | null>(null)

  const fillColor = useMemo(() => fillColorExpression(domainMax), [domainMax])

  // The side panel is map padding, so bounds and fitBounds work with the part of the map it leaves
  // visible. The controls panel is not: padding there would raise the minimum zoom until the city
  // fits beneath it. Instead the north bound grows by the panel's height at the current zoom, so
  // the map can be dragged down from under the panel while staying fully zoomed out.
  const padding = useMemo(
    () => ({ top: 0, left: 0, right: insets.right, bottom: insets.bottom }),
    [insets.right, insets.bottom],
  )
  const constrainToCity = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const [west, south, east, north] = MAX_BOUNDS
    const extraNorthKm = (insets.top * metersPerPixel(north, map.getZoom())) / 1000
    map.setMaxBounds([west, south, east, north + extraNorthKm / KM_PER_DEGREE_LAT])
  }, [insets.top])
  useEffect(constrainToCity, [constrainToCity])

  // Push the current metric into feature state instead of re-uploading the GeoJSON on every
  // slider move; the fill layer reads it back through fillColorExpression.
  const applyValues = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map || !areas || !map.getSource(AREAS_SOURCE)) return
    for (const feature of areas.features) {
      const { key_code: keyCode, population } = feature.properties
      const value = values.get(keyCode)
      let state: number
      if (metric === 'count') state = value?.count ?? 0
      else if (population < minPopulationForRate) state = -1
      else state = value?.rate ?? 0
      map.setFeatureState({ source: AREAS_SOURCE, id: keyCode }, { value: state, unrecorded: unrecordedAreas.has(keyCode) })
    }
  }, [areas, values, metric, minPopulationForRate, unrecordedAreas])

  useEffect(() => {
    if (sourceReady) applyValues()
  }, [sourceReady, applyValues])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !sourceReady) return
    if (selectedKeyRef.current) {
      map.setFeatureState({ source: AREAS_SOURCE, id: selectedKeyRef.current }, { selected: false })
    }
    if (selectedKey) map.setFeatureState({ source: AREAS_SOURCE, id: selectedKey }, { selected: true })
    selectedKeyRef.current = selectedKey
  }, [selectedKey, sourceReady])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !focus || !areas) return
    const feature = areas.features.find((f) => f.properties.key_code === focus.keyCode)
    if (!feature) return
    map.fitBounds(geometryBounds(feature.geometry as unknown as Geometry), { padding: 60, maxZoom: 16, duration: 800 })
  }, [focus, areas])

  const setHovered = (keyCode: string | null) => {
    const map = mapRef.current?.getMap()
    if (!map || !map.getSource(AREAS_SOURCE)) return
    if (hoveredKeyRef.current && hoveredKeyRef.current !== keyCode) {
      map.setFeatureState({ source: AREAS_SOURCE, id: hoveredKeyRef.current }, { hover: false })
    }
    if (keyCode) map.setFeatureState({ source: AREAS_SOURCE, id: keyCode }, { hover: true })
    hoveredKeyRef.current = keyCode
  }

  const onMouseMove = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    if (!feature) {
      setHovered(null)
      setHover(null)
      return
    }
    const properties = feature.properties as AreaProperties
    setHovered(properties.key_code)
    setHover({ properties, longitude: event.lngLat.lng, latitude: event.lngLat.lat })
  }

  const onMouseLeave = () => {
    setHovered(null)
    setHover(null)
  }

  const onClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    const keyCode = feature ? (feature.properties as AreaProperties).key_code : null
    onSelect(keyCode === selectedKey ? null : keyCode)
  }

  const onSourceData = (event: MapSourceDataEvent) => {
    if (!sourceReady && event.sourceId === AREAS_SOURCE && event.isSourceLoaded) setSourceReady(true)
  }

  const hoverValue = hover ? values.get(hover.properties.key_code) : undefined
  const hoverUnrecorded = hover ? unrecordedAreas.has(hover.properties.key_code) : false

  return (
    <MapGL
      ref={mapRef}
      mapStyle={style}
      initialViewState={{ longitude: 130.4, latitude: 33.59, zoom: 11.6 }}
      padding={padding}
      minZoom={9.5}
      maxZoom={17}
      onLoad={constrainToCity}
      onZoom={constrainToCity}
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={['areas-fill']}
      cursor={hover ? 'pointer' : 'grab'}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onSourceData={onSourceData}
    >
      {areas && (
        <Source id={AREAS_SOURCE} type="geojson" data={areas as unknown as FeatureCollection} promoteId="key_code">
          <Layer
            id="areas-fill"
            type="fill"
            beforeId={FIRST_SYMBOL_LAYER}
            paint={{ 'fill-color': fillColor, 'fill-opacity': 0.72 }}
          />
          <Layer
            id="areas-line"
            type="line"
            beforeId={FIRST_SYMBOL_LAYER}
            paint={{
              'line-color': '#4a5568',
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.25, 13, 0.7, 16, 1.5],
              'line-opacity': 0.7,
            }}
          />
          <Layer
            id="areas-highlight"
            type="line"
            paint={{
              'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#0b6e99', '#111827'],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                3,
                ['boolean', ['feature-state', 'hover'], false],
                2,
                0,
              ],
            }}
          />
          <Layer
            id="areas-label"
            type="symbol"
            minzoom={14}
            layout={{
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 11,
              'text-max-width': 6,
            }}
            paint={{ 'text-color': '#1f2937', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.2 }}
          />
        </Source>
      )}
      {cityOutline && (
        <Source id={CITY_SOURCE} type="geojson" data={cityOutline as unknown as FeatureCollection}>
          {/* The edge of the recorded area: thefts outside this line are not in the data. */}
          <Layer
            id="city-outline"
            type="line"
            beforeId={FIRST_SYMBOL_LAYER}
            layout={{ 'line-join': 'round' }}
            paint={{
              'line-color': '#1f2937',
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 13, 3, 16, 5],
              'line-opacity': 0.85,
            }}
          />
        </Source>
      )}
      {hover && (
        <Popup
          longitude={hover.longitude}
          latitude={hover.latitude}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={12}
          maxWidth="260px"
        >
          <div className="popup-title">
            <span className="ward">{hover.properties.ward}</span>
            {hover.properties.name}
          </div>
          {hoverUnrecorded ? (
            <div className="popup-row">
              <span>記録対象外</span>
              <strong>全期間で記録なし</strong>
            </div>
          ) : (
            <div className="popup-row">
              <span>{METRIC_LABELS[metric]}</span>
              <strong>{formatValue(hoverValue, metric)}</strong>
            </div>
          )}
          {metric === 'rate' && !hoverUnrecorded && (
            <div className="popup-row">
              <span>件数</span>
              <strong>{hoverValue?.count ?? 0}件</strong>
            </div>
          )}
          <div className="popup-row">
            <span>人口</span>
            <strong>{hover.properties.population.toLocaleString()}人</strong>
          </div>
        </Popup>
      )}
      <NavigationControl position="bottom-right" showCompass={false} />
      <ScaleControl position="bottom-right" />
    </MapGL>
  )
}

export default MapView
