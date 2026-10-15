import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/providers";
import "maplibre-gl/dist/maplibre-gl.css";
import "@fontsource-variable/inter";
import "./globals.css";
export const metadata: Metadata = {
  title: "OutageMap — карта городских проблем",
  description:
    "Сообщения жителей об отключениях и городских проблемах Казахстана и России.",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
