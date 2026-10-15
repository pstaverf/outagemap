export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site")
    return false;
  try {
    const source = new URL(origin);
    return (
      (process.env.NODE_ENV !== "production" || source.protocol === "https:") &&
      ["http:", "https:"].includes(source.protocol) &&
      source.host === request.headers.get("host")
    );
  } catch {
    return false;
  }
}
