'use client';
import { useEffect, useRef } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MapInstance } from 'maplibre-gl';
import { mapStyle, type MapLayer } from '@/lib/map-style';
import type { IssueView } from '@/lib/schemas';
export interface Bounds { west: number; east: number; south: number; north: number }
interface Props { issues: IssueView[]; layer: MapLayer; center: [number, number]; picking: boolean; onBounds: (bounds: Bounds) => void; onSelect: (id: string) => void; onPick: (lat: number, lng: number) => void; onError: (message: string) => void }
export default function Map({ issues, layer, center, picking, onBounds, onSelect, onPick, onError }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const props = useRef({ onBounds, onSelect, onPick, onError, picking, issues });
  useEffect(() => { props.current = { onBounds, onSelect, onPick, onError, picking, issues }; });
  useEffect(() => {
    if (!container.current) return;
    const instance = new maplibregl.Map({ container: container.current, style: mapStyle('scheme'), center: [76.945, 43.244], zoom: 12.5, attributionControl: { compact: true } });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    let timer: ReturnType<typeof setTimeout>;
    const update = () => { clearTimeout(timer); timer = setTimeout(() => { const b = instance.getBounds(); props.current.onBounds({ west: Math.max(-180, b.getWest()), east: Math.min(180, b.getEast()), south: b.getSouth(), north: b.getNorth() }); const c = instance.getCenter(); localStorage.setItem('outagemap:position', JSON.stringify({ lng: c.lng, lat: c.lat, zoom: instance.getZoom() })); }, 350); };
    instance.on('moveend', update);
    instance.on('style.load', () => {
      instance.addSource('issues', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterMaxZoom: 14, clusterRadius: 45 });
      instance.addLayer({ id: 'clusters', type: 'circle', source: 'issues', filter: ['has', 'point_count'], paint: { 'circle-color': '#234e45', 'circle-radius': 23, 'circle-stroke-width': 4, 'circle-stroke-color': '#ffffff' } });
      instance.addLayer({ id: 'cluster-count', type: 'symbol', source: 'issues', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13 }, paint: { 'text-color': '#ffffff' } });
      instance.addLayer({ id: 'points', type: 'circle', source: 'issues', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': ['match', ['get', 'status'], 'CONFIRMED', '#c77d30', 'RESOLVED', '#52856c', '#cf614d'], 'circle-radius': 9, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } });
      setData(); update();
    });
    function setData() { (instance.getSource('issues') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: props.current.issues.map(i => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lng, i.lat] }, properties: { id: i.id, status: i.status } })) }); }
    instance.on('click', async event => {
      if (props.current.picking) { props.current.onPick(event.lngLat.lat, event.lngLat.lng); return; }
      if (!instance.getLayer('points')) return;
      const features = instance.queryRenderedFeatures(event.point, { layers: ['clusters', 'points'] });
      const feature = features[0];
      if (!feature) return;
      if (feature.properties.cluster) { try { const zoom = await (instance.getSource('issues') as GeoJSONSource).getClusterExpansionZoom(Number(feature.properties.cluster_id)); if (feature.geometry.type === 'Point') instance.easeTo({ center: feature.geometry.coordinates as [number, number], zoom }); } catch { props.current.onError('Не удалось раскрыть группу'); } }
      else props.current.onSelect(String(feature.properties.id));
    });
    instance.on('error', () => props.current.onError('Картографический слой недоступен. Список проблем продолжает работать.'));
    return () => { clearTimeout(timer); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => { map.current?.setStyle(mapStyle(layer)); }, [layer]);
  useEffect(() => { map.current?.flyTo({ center, zoom: 13, duration: 700 }); }, [center]);
  useEffect(() => { const instance = map.current; if (!instance) return; (instance.getSource('issues') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: issues.map(i => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lng, i.lat] }, properties: { id: i.id, status: i.status } })) }); }, [issues]);
  return <div ref={container} className={`map-canvas ${picking ? 'picking' : ''}`} aria-label="Интерактивная карта городских проблем" />;
}
