import { NextResponse, type NextRequest } from "next/server";
function origin(value: string | undefined): string[] {
  try {
    return value ? [new URL(value).origin] : [];
  } catch {
    return [];
  }
}
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const external = [
    ...(process.env.NEXT_PUBLIC_MAP_ASSET_ORIGINS ?? "")
      .split(",")
      .flatMap((value) => origin(value.trim())),
    ...origin(process.env.NEXT_PUBLIC_VECTOR_STYLE),
    ...origin(process.env.NEXT_PUBLIC_SATELLITE_URL),
    ...origin(process.env.S3_PUBLIC_ENDPOINT),
  ];
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${external.join(" ")}`,
    "font-src 'self'",
    `connect-src 'self' https://tiles.openfreemap.org ${external.join(" ")}${process.env.NODE_ENV !== "production" ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'self' https://arena.ai https://*.arena.ai https://*.e2b.app",
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)",
  );
  if (process.env.NODE_ENV === "production")
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  return response;
}
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts).*)"],
};
