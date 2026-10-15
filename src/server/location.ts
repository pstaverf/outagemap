import { isIP } from "node:net";
import { timingSafeEqual, createHmac } from "node:crypto";
import { open, type CityResponse, type AsnResponse } from "maxmind";
import { locationSchema, type Location } from "@/lib/schemas";
export function trustedIP(headers: Headers): string | null {
  const expected = process.env.TRUSTED_PROXY_SECRET;
  const actual = headers.get("x-outagemap-proxy-secret");
  if (!expected || !actual) return null;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const ip = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return ip && isIP(ip) ? ip : null;
}
const fallback: Location = {
  city: "Казахстан",
  region: "",
  center: [67.5, 48],
  zoom: 4,
  source: "fallback",
};
let cityReader: ReturnType<typeof open<CityResponse>> | undefined;
let asnReader: ReturnType<typeof open<AsnResponse>> | undefined;
export async function lookupLocation(ip: string | null): Promise<Location> {
  if (!ip || !process.env.GEOLITE_CITY_PATH || !process.env.GEOLITE_ASN_PATH)
    return fallback;
  try {
    cityReader ??= open<CityResponse>(process.env.GEOLITE_CITY_PATH);
    asnReader ??= open<AsnResponse>(process.env.GEOLITE_ASN_PATH);
    const [cities, asns] = await Promise.all([cityReader, asnReader]);
    const asn = asns.get(ip);
    const denied = (process.env.GEO_DENIED_ASNS ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number);
    if (
      !asn ||
      denied.includes(asn.autonomous_system_number) ||
      /hosting|cloud|data.?center|amazon|google|microsoft|digitalocean|hetzner|ovh|vpn/i.test(
        asn.autonomous_system_organization,
      )
    )
      return fallback;
    const result = cities.get(ip);
    if (
      !result ||
      !["KZ", "RU"].includes(result.country?.iso_code ?? "") ||
      !result.city ||
      (result.location?.accuracy_radius ?? 1000) > 100
    )
      return fallback;
    const parsed = locationSchema.safeParse({
      city: result.city.names?.ru ?? result.city.names?.en,
      region: result.subdivisions?.at(-1)?.names?.ru ?? "",
      center: [result.location?.longitude, result.location?.latitude],
      zoom: 11,
      source: "ip",
    });
    return parsed.success ? parsed.data : fallback;
  } catch {
    cityReader = undefined;
    asnReader = undefined;
    return fallback;
  }
}
export function encodeLocation(location: Location) {
  const value = Buffer.from(
    JSON.stringify({
      ...location,
      expiresAt:
        Date.now() + (location.source === "choice" ? 31536000000 : 86400000),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update(value)
    .digest("base64url");
  return `${value}.${signature}`;
}
export function decodeLocation(value: string | undefined): Location | null {
  if (!value || value.length > 2000) return null;
  try {
    const [body, signature] = value.split(".");
    const expected = createHmac("sha256", process.env.AUTH_SECRET ?? "")
      .update(body)
      .digest("base64url");
    if (
      !signature ||
      Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return null;
    const decoded: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    );
    if (
      !decoded ||
      typeof decoded !== "object" ||
      !("expiresAt" in decoded) ||
      typeof decoded.expiresAt !== "number" ||
      decoded.expiresAt < Date.now()
    )
      return null;
    const parsed = locationSchema.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
