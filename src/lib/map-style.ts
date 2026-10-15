import type { StyleSpecification } from "maplibre-gl";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { z } from "zod";
export type MapLayer = "scheme" | "satellite" | "hybrid";
const styleSchema = z.custom<StyleSpecification>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    validateStyleMin(value as StyleSpecification).length === 0,
);
function resolveTemplate(value: string, base: string) {
  return new URL(value, base).href.replace(/%7B/gi, "{").replace(/%7D/gi, "}");
}
export async function mapStyle(
  layer: MapLayer,
  signal?: AbortSignal,
): Promise<StyleSpecification> {
  const url =
    process.env.NEXT_PUBLIC_VECTOR_STYLE ??
    "https://tiles.openfreemap.org/styles/positron";
  const response = await fetch(url, { signal, cache: "force-cache" });
  if (!response.ok) throw new Error("Картографический слой недоступен");
  const style = styleSchema.parse(await response.json());
  if (typeof style.glyphs === "string")
    style.glyphs = resolveTemplate(style.glyphs, url);
  if (typeof style.sprite === "string")
    style.sprite = resolveTemplate(style.sprite, url);
  for (const source of Object.values(style.sources)) {
    if ("url" in source && source.url)
      source.url = resolveTemplate(source.url, url);
    if ("tiles" in source && source.tiles)
      source.tiles = source.tiles.map((tile) => resolveTemplate(tile, url));
  }
  const satellite = process.env.NEXT_PUBLIC_SATELLITE_URL;
  if (layer !== "scheme") {
    if (!satellite || !process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION)
      throw new Error("Укажите источник и атрибуцию спутникового слоя");
    style.sources.satellite = {
      type: "raster",
      tiles: [satellite],
      tileSize: 256,
      attribution: process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION,
    };
    style.layers = [
      { id: "satellite", type: "raster", source: "satellite" },
      ...(layer === "hybrid"
        ? style.layers.filter((l) => l.type === "symbol")
        : []),
    ];
  }
  return style;
}
