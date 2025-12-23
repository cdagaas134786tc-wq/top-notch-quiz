import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { encode } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { jsonError } from "@/lib/apiResponse";
import { sessionCookieName, isSecureCookies } from "@/lib/authCookies";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `auth:login:${ip}`, limit: 20, windowMs: 60_000 });

  const rateHeaders = {
    "x-ratelimit-limit": String(rl.limit),
    "x-ratelimit-remaining": String(rl.remaining),
    "x-ratelimit-reset": String(rl.resetMs),
  };

  if (!rl.ok) {
    return jsonError("Too many requests.", { status: 429, headers: rateHeaders });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", { status: 400, headers: rateHeaders });
  }

  const { email, password } = (body ?? {}) as { email?: string; password?: string };
  const normalizedEmail = (email ?? "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return jsonError("Email and password are required.", { status: 400, headers: rateHeaders });
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user?.passwordHash) {
    return jsonError("Invalid email or password.", { status: 401, headers: rateHeaders });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return jsonError("Invalid email or password.", { status: 401, headers: rateHeaders });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return jsonError("Server misconfigured: missing NEXTAUTH_SECRET.", {
      status: 500,
      headers: rateHeaders,
    });
  }

  // Create a NextAuth-compatible JWT session cookie.
  const token = await encode({
    secret,
    token: {
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
    },
    maxAge: 60 * 60 * 24 * 30,
  });

  const res = NextResponse.json(
    { ok: true, user: { id: user.id, email: user.email, role: user.role } },
    { status: 200, headers: rateHeaders }
  );

  res.cookies.set(sessionCookieName(req), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookies(req),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
