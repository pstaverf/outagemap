"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
      }),
  );
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;
    const query = new URLSearchParams();
    for (const value of [
      process.env.NEXT_PUBLIC_VECTOR_STYLE ??
        "https://tiles.openfreemap.org/styles/positron",
      process.env.NEXT_PUBLIC_SATELLITE_URL,
    ]) {
      if (value) {
        try {
          query.append("origin", new URL(value).origin);
        } catch {
          continue;
        }
      }
    }
    void navigator.serviceWorker
      .register(`/sw.js?${query}`)
      .catch(() => undefined);
  }, []);
  return (
    <SessionProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
