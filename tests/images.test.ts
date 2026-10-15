import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { sanitizeImage } from "../src/lib/images";
test("photos are bounded, re-encoded and stripped of metadata", async () => {
  const source = await sharp({
    create: { width: 2200, height: 1200, channels: 3, background: "#fff" },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: "Private camera owner" } } })
    .toBuffer();
  assert.ok((await sharp(source).metadata()).exif);
  const clean = await sanitizeImage(source, "image/jpeg");
  const result = await sharp(clean).metadata();
  assert.equal(result.format, "webp");
  assert.equal(result.width, 1920);
  assert.equal(result.exif, undefined);
  assert.equal(result.xmp, undefined);
  await assert.rejects(() => sanitizeImage(source, "image/png"));
  await assert.rejects(() =>
    sanitizeImage(Buffer.from('<svg onload="alert(1)"></svg>'), "image/jpeg"),
  );
});
