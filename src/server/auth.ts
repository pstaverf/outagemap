import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { createTransport } from "nodemailer";
import { cookies } from "next/headers";
import { db } from "./db";
import { limit } from "./redis";
import { emailSchema } from "@/lib/schemas";
export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const jar = await cookies();
  const remember = jar.get("outagemap-remember")?.value === "yes";
  return {
    adapter: PrismaAdapter(db),
    session: { strategy: "database", maxAge: (remember ? 30 : 1) * 86400 },
    useSecureCookies: process.env.NODE_ENV === "production",
    providers: [
      Google({ allowDangerousEmailAccountLinking: true }),
      Nodemailer({
        server: process.env.EMAIL_SERVER ?? "smtp://localhost:1025",
        from: process.env.EMAIL_FROM ?? "OutageMap <noreply@localhost>",
        maxAge: 900,
        normalizeIdentifier(identifier) {
          return emailSchema.parse(identifier);
        },
        async sendVerificationRequest({ identifier, url, provider }) {
          const email = emailSchema.parse(identifier);
          await limit(`email:${email}`, 5, 900);
          const transport = createTransport(provider.server);
          await transport.sendMail({
            to: email,
            from: provider.from,
            subject: "Вход в OutageMap",
            text: `Ссылка для входа в OutageMap:\n\n${url}\n\nДействует 15 минут. Если вы не запрашивали вход, проигнорируйте письмо.`,
            disableFileAccess: true,
            disableUrlAccess: true,
          });
        },
      }),
    ],
    pages: {
      signIn: "/login",
      verifyRequest: "/login?sent=1",
      error: "/login?error=1",
    },
    callbacks: {
      async signIn({ user, account, profile }) {
        if (
          account?.provider === "google" &&
          (!profile ||
            !("email_verified" in profile) ||
            profile.email_verified !== true)
        )
          return false;
        if (user.email) {
          const email = emailSchema.safeParse(user.email);
          if (!email.success) return false;
          const existing = await db.user.findUnique({
            where: { email: email.data },
          });
          if (existing?.blocked) return false;
        }
        if (user.id) {
          const existing = await db.user.findUnique({ where: { id: user.id } });
          if (existing?.blocked) return false;
        }
        return true;
      },
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
  };
});
