import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { jsonError, jsonOk } from "@/lib/apiResponse";

export const runtime = "nodejs";
import { requireAdmin, requireAuth } from "@/lib/apiAuth";

function rateHeaders(rl: { limit: number; remaining: number; resetMs: number }) {
  return {
    "x-ratelimit-limit": String(rl.limit),
    "x-ratelimit-remaining": String(rl.remaining),
    "x-ratelimit-reset": String(rl.resetMs),
  };
}

// User-facing quiz read API (published quizzes), plus admin CRUD alias.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `quiz:get:${ip}`, limit: 120, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const categorySlug = searchParams.get("category");

  if (id) {
    const auth = await requireAuth(req);

    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        questions: {
          orderBy: { order: "asc" },
          include: {
            choices: {
              orderBy: { order: "asc" },
              select: { id: true, text: true, order: true },
            },
          },
        },
      },
    });

    if (!quiz) return jsonError("Quiz not found.", { status: 404, headers });

    if (!quiz.isPublished && auth?.role !== "ADMIN") {
      return jsonError("Quiz not available.", { status: 404, headers });
    }

    return jsonOk({ ok: true, quiz }, { headers });
  }

  const quizzes = await prisma.quiz.findMany({
    where: {
      isPublished: true,
      ...(categorySlug
        ? {
            category: { slug: categorySlug },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      timeLimitSeconds: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  return jsonOk({ ok: true, quizzes }, { headers });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return jsonError("Unauthorized.", { status: 401 });

  const rl = rateLimit({ key: `quiz:post:${admin.userId}`, limit: 60, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        description?: string;
        categoryId?: string | null;
        timeLimitSeconds?: number | null;
        isPublished?: boolean;
      }
    | null;

  const title = (body?.title ?? "").trim();
  if (!title) return jsonError("Title is required.", { status: 400, headers });

  const quiz = await prisma.quiz.create({
    data: {
      title,
      description: body?.description?.trim() || null,
      categoryId: body?.categoryId ?? null,
      timeLimitSeconds: body?.timeLimitSeconds ?? null,
      isPublished: Boolean(body?.isPublished),
      createdById: admin.userId,
    },
  });

  return jsonOk({ ok: true, quiz }, { status: 201, headers });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return jsonError("Unauthorized.", { status: 401 });

  const rl = rateLimit({ key: `quiz:put:${admin.userId}`, limit: 120, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const body = (await req.json().catch(() => null)) as
    | {
        id?: string;
        title?: string;
        description?: string | null;
        categoryId?: string | null;
        timeLimitSeconds?: number | null;
        isPublished?: boolean;
      }
    | null;

  if (!body?.id) return jsonError("id is required.", { status: 400, headers });

  const quiz = await prisma.quiz.update({
    where: { id: body.id },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.timeLimitSeconds !== undefined ? { timeLimitSeconds: body.timeLimitSeconds } : {}),
      ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
    },
  });

  return jsonOk({ ok: true, quiz }, { headers });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return jsonError("Unauthorized.", { status: 401 });

  const rl = rateLimit({ key: `quiz:delete:${admin.userId}`, limit: 60, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return jsonError("id is required.", { status: 400, headers });

  await prisma.quiz.delete({ where: { id: body.id } });
  return jsonOk({ ok: true }, { headers });
}
