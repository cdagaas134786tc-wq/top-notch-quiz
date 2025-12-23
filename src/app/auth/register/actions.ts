"use server";

import bcrypt from "bcrypt";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

function redirectWithError(message: string) {
  redirect(`/auth/register?error=${encodeURIComponent(message)}`);
}

export async function registerAction(formData: FormData): Promise<void> {
  const emailRaw = String(formData.get("email") ?? "");
  const nameRaw = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");
  const adminCode = String(formData.get("adminCode") ?? "").trim();

  const email = emailRaw.trim().toLowerCase();
  const name = nameRaw.trim() || null;

  if (!email || !email.includes("@")) {
    redirectWithError("Please enter a valid email.");
  }
  if (!password || password.length < 8) {
    redirectWithError("Password must be at least 8 characters.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirectWithError("An account with that email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const adminSecret = process.env.ADMIN_REGISTRATION_SECRET;
  const role = adminSecret && adminCode && adminCode === adminSecret ? "ADMIN" : "USER";

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role,
    },
  });

  redirect("/auth/login?registered=1");
}
