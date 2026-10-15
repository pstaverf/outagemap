export function distance(
  lat: number,
  lng: number,
  otherLat: number,
  otherLng: number,
) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((otherLat - lat) * rad) / 2) ** 2 +
    Math.cos(lat * rad) *
      Math.cos(otherLat * rad) *
      Math.sin(((otherLng - lng) * rad) / 2) ** 2;
  return (
    6371000 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)))
  );
}
