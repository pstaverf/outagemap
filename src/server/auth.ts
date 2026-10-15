import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Nodemailer from 'next-auth/providers/nodemailer';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from './db';
import { limit } from './redis';
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 },
  providers: [Google, Nodemailer({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM, maxAge: 900 })],
  pages: { signIn: '/login', verifyRequest: '/login?sent=1', error: '/login?error=1' },
  callbacks: { async signIn({ user }) { if (user.email) await limit(`login:${user.email}`, 5, 900); if (user.id) { const record = await db.user.findUnique({ where: { id: user.id } }); if (record?.blocked) return false; } return true; }, session({ session, user }) { session.user.id = user.id; return session; } }
});
