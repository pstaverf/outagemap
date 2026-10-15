import sharp from "sharp";
export async function sanitizeImage(bytes: Uint8Array, mime: string) {
  if (bytes.length > 8 * 1024 * 1024) throw new Error("IMAGE_SIZE");
  const image = sharp(bytes, {
    limitInputPixels: 40000000,
    animated: false,
    failOn: "warning",
  });
  const metadata = await image.metadata();
  const formats: Record<string, string> = {
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  if (
    !metadata.format ||
    formats[metadata.format] !== mime ||
    (metadata.pages ?? 1) > 1
  )
    throw new Error("IMAGE_FORMAT");
  return image
    .rotate()
    .resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
}
