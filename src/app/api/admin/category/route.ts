import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { jsonError, jsonOk } from "@/lib/apiResponse";

export const runtime = "nodejs";

function rateHeaders(rl: { limit: number; remaining: number; resetMs: number }) {
  return {
    "x-ratelimit-limit": String(rl.limit),
    "x-ratelimit-remaining": String(rl.remaining),
    "x-ratelimit-reset": String(rl.resetMs),
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return jsonError("Forbidden.", { status: 403 });

  const ip = getClientIp(req);
  const rl = rateLimit({ key: `admin:category:get:${admin.userId}:${ip}`, limit: 240, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
  });

  return jsonOk({ ok: true, categories }, { headers });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return jsonError("Forbidden.", { status: 403 });

  const rl = rateLimit({ key: `admin:category:post:${admin.userId}`, limit: 60, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const body = (await req.json().catch(() => null)) as { name?: string; slug?: string } | null;
  const name = (body?.name ?? "").trim();
  const slug = (body?.slug ?? "").trim();

  if (!name || !slug) return jsonError("name and slug are required.", { status: 400, headers });

  try {
    const category = await prisma.category.create({ data: { name, slug } });
    return jsonOk({ ok: true, category }, { status: 201, headers });
  } catch {
    return jsonError("Category already exists.", { status: 409, headers });
  }
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return jsonError("Forbidden.", { status: 403 });

  const rl = rateLimit({ key: `admin:category:put:${admin.userId}`, limit: 120, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const body = (await req.json().catch(() => null)) as { id?: string; name?: string; slug?: string } | null;
  if (!body?.id) return jsonError("id is required.", { status: 400, headers });

  const category = await prisma.category.update({
    where: { id: body.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.slug !== undefined ? { slug: body.slug.trim() } : {}),
    },
  });

  return jsonOk({ ok: true, category }, { headers });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return jsonError("Forbidden.", { status: 403 });

  const rl = rateLimit({ key: `admin:category:delete:${admin.userId}`, limit: 60, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return jsonError("id is required.", { status: 400, headers });

  await prisma.category.delete({ where: { id: body.id } });
  return jsonOk({ ok: true }, { headers });
}
