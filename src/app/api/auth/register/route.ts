import bcrypt from "bcrypt";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { jsonError, jsonOk } from "@/lib/apiResponse";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `auth:register:${ip}`, limit: 10, windowMs: 60_000 });

  const headers = {
    "x-ratelimit-limit": String(rl.limit),
    "x-ratelimit-remaining": String(rl.remaining),
    "x-ratelimit-reset": String(rl.resetMs),
  };

  if (!rl.ok) {
    return jsonError("Too many requests.", { status: 429, headers });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", { status: 400, headers });
  }

  const { email, password, name, adminCode } = (body ?? {}) as {
    email?: string;
    password?: string;
    name?: string;
    adminCode?: string;
  };

  const normalizedEmail = (email ?? "").trim().toLowerCase();
  const displayName = (name ?? "").trim() || null;

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return jsonError("Please provide a valid email.", { status: 400, headers });
  }
  if (!password || password.length < 8) {
    return jsonError("Password must be at least 8 characters.", { status: 400, headers });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return jsonError("Email already in use.", { status: 409, headers });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const adminSecret = process.env.ADMIN_REGISTRATION_SECRET;
  const role = adminSecret && adminCode && adminCode === adminSecret ? "ADMIN" : "USER";

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: displayName,
      passwordHash,
      role,
    },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  return jsonOk({ ok: true, user }, { status: 201, headers });
}
