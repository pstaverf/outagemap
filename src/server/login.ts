"use server";
import { cookies, headers } from "next/headers";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "./auth";
import { trustedIP } from "./location";
import { limit } from "./redis";
import { emailSchema } from "@/lib/schemas";
export async function login(form: FormData) {
  const provider = form.get("provider") === "google" ? "google" : "nodemailer";
  try {
    await limit("auth:global", 1000, 60);
    const ip = trustedIP(await headers());
    if (ip) await limit(`auth-ip:${ip}`, 15, 900);
    (await cookies()).set(
      "outagemap-remember",
      form.get("remember") === "on" ? "yes" : "no",
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 31536000,
      },
    );
    const destination = form.get("returnTo");
    const redirectTo =
      typeof destination === "string" &&
      destination.startsWith("/") &&
      !destination.startsWith("//")
        ? destination
        : "/";
    await signIn(provider, {
      ...(provider === "nodemailer"
        ? { email: emailSchema.parse(form.get("email")) }
        : {}),
      redirectTo,
    });
  } catch (error) {
    if (
      error instanceof AuthError ||
      (error instanceof Error &&
        (error.message === "RATE_LIMIT" || error.name === "ZodError"))
    )
      redirect("/login?error=1");
    throw error;
  }
}
