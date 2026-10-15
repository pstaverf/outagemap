import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/server/auth";
import { db } from "@/server/db";
import { ProfileManager } from "@/components/profile-manager";
export const dynamic = "force-dynamic";
export default async function Profile() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      issues: { orderBy: { createdAt: "desc" }, take: 100 },
      reviews: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!user || user.blocked) redirect("/login");
  return (
    <main className="document">
      <Link href="/">← На карту</Link>
      <h1>Ваш профиль</h1>
      <p>{user.email}</p>
      {user.role === "MODERATOR" && (
        <Link href="/moderation">Панель модератора</Link>
      )}
      <ProfileManager
        name={user.name ?? ""}
        issues={user.issues}
        reviews={user.reviews}
      />
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="secondary">Выйти</button>
      </form>
    </main>
  );
}
