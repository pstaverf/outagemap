import { mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const packageDirectory = dirname(require.resolve("maplibre-gl/package.json"));
await mkdir("public/maplibre", { recursive: true });
await copyFile(
  join(packageDirectory, "dist/maplibre-gl-worker.mjs"),
  "public/maplibre/maplibre-gl-worker.mjs",
);
