import type { StyleSpecification } from 'maplibre-gl';
export type MapLayer = 'scheme' | 'satellite' | 'hybrid';
export function mapStyle(layer: MapLayer): string | StyleSpecification {
  const vector = process.env.NEXT_PUBLIC_VECTOR_STYLE ?? 'https://tiles.openfreemap.org/styles/positron';
  const satellite = process.env.NEXT_PUBLIC_SATELLITE_URL;
  if (layer === 'scheme' || !satellite) return vector;
  return { version: 8, sources: { satellite: { type: 'raster', tiles: [satellite], tileSize: 256, attribution: process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION ?? '© MapTiler © OpenStreetMap contributors' } }, layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }] };
}
