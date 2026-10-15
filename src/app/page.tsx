import { cookies, headers } from "next/headers";
import { Dashboard } from "@/components/dashboard";
import { decodeLocation, lookupLocation, trustedIP } from "@/server/location";
export const dynamic = "force-dynamic";
export default async function Home() {
  const jar = await cookies();
  const initialLocation =
    decodeLocation(jar.get("outagemap-location")?.value) ??
    (await lookupLocation(trustedIP(await headers())));
  return <Dashboard initialLocation={initialLocation} />;
}
