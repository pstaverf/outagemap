"use client";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource, type Map as MapInstance } from "maplibre-gl";
import { mapStyle, type MapLayer } from "@/lib/map-style";
import { z } from "zod";
import { api } from "@/lib/api";
import { issueViewSchema, geocodeResultSchema } from "@/lib/schemas";
import type { IssueView } from "@/lib/schemas";
export interface Bounds {
  west: number;
  east: number;
  south: number;
  north: number;
}
interface Props {
  initialZoom: number;
  draftPoint: [number, number] | null;
  highlight?: z.infer<typeof geocodeResultSchema>["geojson"];
  issues: IssueView[];
  layer: MapLayer;
  center: [number, number];
  picking: boolean;
  onBounds: (bounds: Bounds) => void;
  onSelect: (id: string) => void;
  onPick: (lat: number, lng: number) => void;
  onError: (message: string) => void;
}
export default function Map({
  initialZoom,
  draftPoint,
  highlight,
  issues,
  layer,
  center,
  picking,
  onBounds,
  onSelect,
  onPick,
  onError,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const props = useRef({
    onBounds,
    onSelect,
    onPick,
    onError,
    picking,
    issues,
  });
  useEffect(() => {
    props.current = { onBounds, onSelect, onPick, onError, picking, issues };
  });
  const initialView = useRef({ center, initialZoom });
  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const instance = new maplibregl.Map({
      container: container.current,
      style: { version: 8, sources: {}, layers: [] },
      center: initialView.current.center,
      zoom: initialView.current.initialZoom,
      attributionControl: { compact: true },
      locale: {
        "NavigationControl.ZoomIn": "Приблизить",
        "NavigationControl.ZoomOut": "Отдалить",
        "NavigationControl.ResetBearing": "Сбросить направление",
        "AttributionControl.ToggleAttribution": "Показать атрибуцию",
      },
    });
    map.current = instance;
    try {
      const raw = localStorage.getItem("outagemap:position");
      if (raw && !new URLSearchParams(window.location.search).has("issue")) {
        const position = z
          .object({
            lng: z.number().min(-180).max(180),
            lat: z.number().min(-85).max(85),
            zoom: z.number().min(2).max(20),
          })
          .parse(JSON.parse(raw));
        instance.jumpTo({
          center: [position.lng, position.lat],
          zoom: position.zoom,
        });
      }
    } catch {
      localStorage.removeItem("outagemap:position");
    }

    instance.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        visualizePitch: true,
      }),
      "bottom-right",
    );
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const b = instance.getBounds();
        props.current.onBounds({
          west: Math.max(-180, b.getWest()),
          east: Math.min(180, b.getEast()),
          south: b.getSouth(),
          north: b.getNorth(),
        });
        const c = instance.getCenter();
        localStorage.setItem(
          "outagemap:position",
          JSON.stringify({ lng: c.lng, lat: c.lat, zoom: instance.getZoom() }),
        );
      }, 350);
    };
    instance.on("moveend", update);
    instance.on("style.load", () => {
      if (instance.getSource("issues")) return;
      instance.addSource("issues", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 45,
      });
      instance.addLayer({
        id: "clusters",
        type: "circle",
        source: "issues",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#234e45",
          "circle-radius": 23,
          "circle-stroke-width": 4,
          "circle-stroke-color": "#ffffff",
        },
      });
      instance.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "issues",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 13,
        },
        paint: { "text-color": "#ffffff" },
      });
      instance.addLayer({
        id: "points",
        type: "circle",
        source: "issues",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "status"],
            "CONFIRMED",
            "#c77d30",
            "RESOLVED",
            "#52856c",
            "#cf614d",
          ],
          "circle-radius": 9,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });
      const source = process.env.NEXT_PUBLIC_BUILDING_SOURCE ?? "openmaptiles";
      if (instance.getSource(source)) {
        instance.addLayer(
          {
            id: "buildings-3d",
            type: "fill-extrusion",
            source,
            "source-layer":
              process.env.NEXT_PUBLIC_BUILDING_SOURCE_LAYER ?? "building",
            minzoom: 15,
            paint: {
              "fill-extrusion-color": "#c7cec3",
              "fill-extrusion-height": [
                "coalesce",
                ["get", "render_height"],
                ["get", "height"],
                6,
              ],
              "fill-extrusion-base": [
                "coalesce",
                ["get", "render_min_height"],
                ["get", "min_height"],
                0,
              ],
              "fill-extrusion-opacity": 0.65,
            },
          },
          "clusters",
        );
      }
      instance.addSource("highlight", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      instance.addLayer({
        id: "highlight",
        type: "line",
        source: "highlight",
        paint: { "line-color": "#28584b", "line-width": 3 },
      });
      setData();
      update();
    });
    function setData() {
      (instance.getSource("issues") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: props.current.issues.map((i) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [i.lng, i.lat] },
          properties: { id: i.id, status: i.status },
        })),
      });
    }
    instance.on("click", async (event) => {
      if (props.current.picking) {
        props.current.onPick(event.lngLat.lat, event.lngLat.lng);
        return;
      }
      if (!instance.getLayer("points")) return;
      const features = instance.queryRenderedFeatures(event.point, {
        layers: ["clusters", "points"],
      });
      const feature = features[0];
      if (!feature) {
        const buildings = instance.getLayer("buildings-3d")
          ? instance.queryRenderedFeatures(event.point, {
              layers: ["buildings-3d"],
            })
          : [];
        const building = buildings[0];
        if (
          building &&
          (building.geometry.type === "Polygon" ||
            building.geometry.type === "MultiPolygon")
        ) {
          (instance.getSource("highlight") as GeoJSONSource).setData({
            type: "Feature",
            geometry: building.geometry,
            properties: {},
          });
          const address =
            typeof building.properties["addr:street"] === "string"
              ? building.properties["addr:street"]
              : "Здание";
          const content = document.createElement("div");
          const heading = document.createElement("strong");
          heading.textContent = address;
          content.append(heading);
          const details = document.createElement("p");
          details.textContent = "Загружаем проблемы рядом…";
          content.append(details);
          void api(
            `/api/issues/nearby?lat=${event.lngLat.lat}&lng=${event.lngLat.lng}`,
            z.object({ items: z.array(issueViewSchema) }),
          )
            .then((result) => {
              details.textContent = `Проблем в радиусе 150 м: ${result.items.length}`;
              for (const issue of result.items.slice(0, 10)) {
                const button = document.createElement("button");
                button.textContent = issue.title;
                button.style.display = "block";
                button.style.minHeight = "44px";
                button.onclick = () => props.current.onSelect(issue.id);
                content.append(button);
              }
            })
            .catch(() => {
              details.textContent = "Не удалось загрузить проблемы рядом";
            });
          void api(
            `/api/geocode?lat=${event.lngLat.lat}&lng=${event.lngLat.lng}`,
            geocodeResultSchema,
          )
            .then((result) => {
              heading.textContent = result.display_name;
            })
            .catch(() => undefined);
          new maplibregl.Popup()
            .setLngLat(event.lngLat)
            .setDOMContent(content)
            .addTo(instance);
        }
        return;
      }
      if (feature.properties.cluster) {
        try {
          const zoom = await (
            instance.getSource("issues") as GeoJSONSource
          ).getClusterExpansionZoom(Number(feature.properties.cluster_id));
          if (feature.geometry.type === "Point")
            instance.easeTo({
              center: feature.geometry.coordinates as [number, number],
              zoom,
            });
        } catch {
          props.current.onError("Не удалось раскрыть группу");
        }
      } else props.current.onSelect(String(feature.properties.id));
    });
    instance.on("error", () =>
      props.current.onError(
        "Картографический слой недоступен. Список проблем продолжает работать.",
      ),
    );
    return () => {
      clearTimeout(timer);
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void mapStyle(layer, controller.signal)
      .then((style) => {
        if (!controller.signal.aborted) map.current?.setStyle(style);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          props.current.onError(
            error instanceof Error ? error.message : "Слой карты недоступен",
          );
      });
    return () => controller.abort();
  }, [layer]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !highlight) return;
    const apply = () => {
      (instance.getSource("highlight") as GeoJSONSource | undefined)?.setData({
        type: "Feature",
        geometry: highlight as GeoJSON.Polygon | GeoJSON.MultiPolygon,
        properties: {},
      });
    };
    if (instance.isStyleLoaded()) apply();
    else instance.once("style.load", apply);
    return () => {
      instance.off("style.load", apply);
    };
  }, [highlight]);
  const lastCenter = useRef(center);
  useEffect(() => {
    if (lastCenter.current === center) return;
    lastCenter.current = center;
    map.current?.flyTo({ center, zoom: 15, pitch: 40, duration: 700 });
  }, [center]);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    (instance.getSource("issues") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: issues.map((i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [i.lng, i.lat] },
        properties: { id: i.id, status: i.status },
      })),
    });
  }, [issues]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !draftPoint) return;
    const marker = new maplibregl.Marker({ color: "#28584b" })
      .setLngLat([draftPoint[1], draftPoint[0]])
      .addTo(instance);
    return () => {
      marker.remove();
    };
  }, [draftPoint]);
  return (
    <div
      ref={container}
      className={`map-canvas ${picking ? "picking" : ""}`}
      role="region"
      aria-label="Интерактивная карта городских проблем"
    />
  );
}
