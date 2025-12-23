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

type SubmitBody = {
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
  const rl = rateLimit({ key: `quiz:submit:${auth.userId}:${ip}`, limit: 30, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const body = (await req.json().catch(() => null)) as SubmitBody | null;
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

  const questions = await prisma.question.findMany({
    where: { quizId: body.quizId },
    select: {
      id: true,
      type: true,
      choices: { select: { id: true, isCorrect: true } },
    },
  });

  if (questions.length === 0) {
    return jsonError("Quiz has no questions.", { status: 400, headers });
  }

  const byQuestionId = new Map(questions.map((q) => [q.id, q] as const));

  // Validate and score
  let score = 0;
  for (const a of body.answers) {
    const q = byQuestionId.get(a.questionId);
    if (!q) return jsonError("Invalid questionId.", { status: 400, headers });

    const submitted = new Set((a.choiceIds ?? []).filter(Boolean));

    // Ensure submitted choices belong to the question
    const validChoiceIds = new Set(q.choices.map((c) => c.id));
    for (const cid of submitted) {
      if (!validChoiceIds.has(cid)) {
        return jsonError("Invalid choiceId.", { status: 400, headers });
      }
    }

    const correct = new Set(q.choices.filter((c) => c.isCorrect).map((c) => c.id));

    const isCorrect = (() => {
      if (q.type === "SINGLE_CHOICE") {
        if (submitted.size !== 1) return false;
        for (const cid of submitted) return correct.has(cid) && correct.size === 1;
        return false;
      }

      // MULTIPLE_CHOICE
      if (submitted.size !== correct.size) return false;
      for (const cid of correct) {
        if (!submitted.has(cid)) return false;
      }
      return true;
    })();

    if (isCorrect) score += 1;
  }

  const attempt = await prisma.$transaction(async (tx) => {
    // If a draft attempt exists, finalize it.
    if (body.attemptId) {
      const existing = await tx.attempt.findFirst({
        where: {
          id: body.attemptId,
          userId: auth.userId,
          quizId: body.quizId,
          status: "IN_PROGRESS",
        },
        select: { id: true, attemptNo: true },
      });

      if (existing) {
        for (const a of body.answers) {
          await tx.answer.upsert({
            where: { attemptId_questionId: { attemptId: existing.id, questionId: a.questionId } },
            create: {
              attemptId: existing.id,
              questionId: a.questionId,
              choices: { connect: (a.choiceIds ?? []).map((id) => ({ id })) },
            },
            update: {
              choices: { set: (a.choiceIds ?? []).map((id) => ({ id })) },
            },
          });
        }

        const finalized = await tx.attempt.update({
          where: { id: existing.id },
          data: {
            status: "SUBMITTED",
            submittedAt: new Date(),
            score,
          },
          select: { id: true, score: true, attemptNo: true },
        });

        return finalized;
      }
    }

    // Otherwise create a fresh submitted attempt.
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
        status: "SUBMITTED",
        submittedAt: new Date(),
        score,
        answers: {
          create: body.answers.map((a) => ({
            questionId: a.questionId,
            choices: { connect: (a.choiceIds ?? []).map((id) => ({ id })) },
          })),
        },
      },
      select: { id: true, score: true, attemptNo: true },
    });

    return created;
  });

  return jsonOk(
    {
      ok: true,
      attempt,
      totalQuestions: questions.length,
    },
    { headers }
  );
}
