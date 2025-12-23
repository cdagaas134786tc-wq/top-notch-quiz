import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
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

type SaveBody = {
  quizId: string;
  attemptId?: string;
  answers: Array<{
    questionId: string;
    choiceIds: string[];
  }>;
};

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("Unauthorized.", { status: 401 });

  const ip = getClientIp(req);
  const rl = rateLimit({ key: `quiz:save:${auth.userId}:${ip}`, limit: 120, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const body = (await req.json().catch(() => null)) as SaveBody | null;
  if (!body?.quizId || !Array.isArray(body.answers)) {
    return jsonError("Invalid payload.", { status: 400, headers });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: body.quizId },
    select: { id: true, isPublished: true },
  });

  if (!quiz || !quiz.isPublished) {
    return jsonError("Quiz not available.", { status: 404, headers });
  }

  const attempt = await prisma.$transaction(async (tx) => {
    // Resolve or create a single IN_PROGRESS attempt.
    const resolvedAttempt = body.attemptId
      ? await tx.attempt.findFirst({
          where: {
            id: body.attemptId,
            userId: auth.userId,
            quizId: body.quizId,
            status: "IN_PROGRESS",
          },
          select: { id: true, attemptNo: true },
        })
      : await tx.attempt.findFirst({
          where: { userId: auth.userId, quizId: body.quizId, status: "IN_PROGRESS" },
          orderBy: { startedAt: "desc" },
          select: { id: true, attemptNo: true },
        });

    if (resolvedAttempt) {
      // Upsert answers
      for (const a of body.answers) {
        await tx.answer.upsert({
          where: { attemptId_questionId: { attemptId: resolvedAttempt.id, questionId: a.questionId } },
          create: {
            attemptId: resolvedAttempt.id,
            questionId: a.questionId,
            choices: { connect: (a.choiceIds ?? []).map((id) => ({ id })) },
          },
          update: {
            choices: { set: (a.choiceIds ?? []).map((id) => ({ id })) },
          },
        });
      }

      return resolvedAttempt;
    }

    const last = await tx.attempt.aggregate({
      where: { userId: auth.userId, quizId: body.quizId },
      _max: { attemptNo: true },
    });

    const attemptNo = (last._max.attemptNo ?? 0) + 1;

    const created = await tx.attempt.create({
      data: {
        userId: auth.userId,
        quizId: body.quizId,
        attemptNo,
        status: "IN_PROGRESS",
        answers: {
          create: body.answers.map((a) => ({
            questionId: a.questionId,
            choices: { connect: (a.choiceIds ?? []).map((id) => ({ id })) },
          })),
        },
      },
      select: { id: true, attemptNo: true },
    });

    return created;
  });

  return jsonOk({ ok: true, attemptId: attempt.id, attemptNo: attempt.attemptNo }, { headers });
}
