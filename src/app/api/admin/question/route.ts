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

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE";

type ChoiceInput = {
  id?: string;
  text: string;
  isCorrect?: boolean;
  order?: number;
};

type CreateBody = {
  quizId: string;
  prompt: string;
  hint?: string | null;
  rationale?: string | null;
  type?: QuestionType;
  order?: number;
  choices: ChoiceInput[];
};

type UpdateBody = {
  id: string;
  prompt?: string;
  hint?: string | null;
  rationale?: string | null;
  type?: QuestionType;
  order?: number;
  choices?: ChoiceInput[];
  move?: "UP" | "DOWN";
};

function normalizeChoices(inputs: ChoiceInput[]) {
  const trimmed = inputs
    .map((c, idx) => ({ ...c, text: c.text.trim(), order: c.order ?? idx }))
    .filter((c) => c.text.length > 0);
  return trimmed;
}

function validateCorrectChoices(type: QuestionType, choices: ChoiceInput[]) {
  const correctCount = choices.filter((c) => Boolean(c.isCorrect)).length;
  if (correctCount < 1) return "At least 1 correct choice is required.";
  if (type === "SINGLE_CHOICE" && correctCount !== 1) {
    return "Single-choice questions must have exactly 1 correct choice.";
  }
  return null;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return jsonError("Forbidden.", { status: 403 });

  const ip = getClientIp(req);
  const rl = rateLimit({ key: `admin:question:get:${admin.userId}:${ip}`, limit: 240, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const { searchParams } = new URL(req.url);
  const quizId = searchParams.get("quizId");
  if (!quizId) return jsonError("quizId is required.", { status: 400, headers });

  const questions = await prisma.question.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
    include: { choices: { orderBy: { order: "asc" } } },
  });

  return jsonOk({ ok: true, questions }, { headers });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return jsonError("Forbidden.", { status: 403 });

  const rl = rateLimit({ key: `admin:question:post:${admin.userId}`, limit: 120, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.quizId || !body.prompt?.trim()) {
    return jsonError("quizId and prompt are required.", { status: 400, headers });
  }

  if (!Array.isArray(body.choices) || body.choices.length < 2) {
    return jsonError("At least 2 choices are required.", { status: 400, headers });
  }

  const type = body.type ?? "SINGLE_CHOICE";
  const normalizedChoices = normalizeChoices(body.choices);
  if (normalizedChoices.length < 2) {
    return jsonError("At least 2 non-empty choices are required.", { status: 400, headers });
  }

  const validationMessage = validateCorrectChoices(type, normalizedChoices);
  if (validationMessage) return jsonError(validationMessage, { status: 400, headers });

  const order: number =
    body.order ??
    (await prisma.question
      .aggregate({ where: { quizId: body.quizId }, _max: { order: true } })
      .then((r) => (r._max.order ?? -1) + 1));

  const question = await prisma.question.create({
    data: {
      quizId: body.quizId,
      prompt: body.prompt.trim(),
      hint: body.hint?.trim() || null,
      rationale: body.rationale?.trim() || null,
      type,
      order,
      choices: {
        create: normalizedChoices.map((c) => ({
          text: c.text,
          order: c.order ?? 0,
          isCorrect: Boolean(c.isCorrect),
        })),
      },
    },
    include: { choices: { orderBy: { order: "asc" } } },
  });

  return jsonOk({ ok: true, question }, { status: 201, headers });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return jsonError("Forbidden.", { status: 403 });

  const rl = rateLimit({ key: `admin:question:put:${admin.userId}`, limit: 240, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const body = (await req.json().catch(() => null)) as UpdateBody | null;
  if (!body?.id) return jsonError("id is required.", { status: 400, headers });

  // Reorder helper: swap question.order with its neighbor.
  if (body.move) {
    try {
      await prisma.$transaction(async (tx) => {
        const q = await tx.question.findUnique({ where: { id: body.id }, select: { id: true, quizId: true, order: true } });
        if (!q) throw new Error("Question not found.");

        const neighbor =
          body.move === "UP"
            ? await tx.question.findFirst({
                where: { quizId: q.quizId, order: { lt: q.order } },
                orderBy: { order: "desc" },
                select: { id: true, order: true },
              })
            : await tx.question.findFirst({
                where: { quizId: q.quizId, order: { gt: q.order } },
                orderBy: { order: "asc" },
                select: { id: true, order: true },
              });

        if (!neighbor) return;

        await tx.question.update({ where: { id: q.id }, data: { order: neighbor.order } });
        await tx.question.update({ where: { id: neighbor.id }, data: { order: q.order } });
      });

      return jsonOk({ ok: true }, { headers });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to reorder question.";
      const status = msg === "Question not found." ? 404 : 400;
      return jsonError(msg, { status, headers });
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const question = await tx.question.update({
        where: { id: body.id },
        data: {
          ...(body.prompt !== undefined ? { prompt: body.prompt.trim() } : {}),
          ...(body.hint !== undefined ? { hint: body.hint?.trim() || null } : {}),
          ...(body.rationale !== undefined ? { rationale: body.rationale?.trim() || null } : {}),
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.order !== undefined ? { order: body.order } : {}),
        },
        include: { choices: true },
      });

      if (body.choices) {
        const incoming = normalizeChoices(body.choices);
        if (incoming.length < 2) throw new Error("At least 2 non-empty choices are required.");

        const effectiveType = body.type ?? question.type;
        const validationMessage = validateCorrectChoices(effectiveType, incoming);
        if (validationMessage) {
          throw new Error(validationMessage);
        }

        const existingIds = new Set(question.choices.map((c) => c.id));
        const incomingIds = new Set(incoming.map((c) => c.id).filter(Boolean) as string[]);

        // Delete removed
        const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
        if (toDelete.length) {
          await tx.choice.deleteMany({ where: { id: { in: toDelete } } });
        }

        // Upsert incoming
        for (const c of incoming) {
          if (c.id) {
            await tx.choice.update({
              where: { id: c.id },
              data: { text: c.text, order: c.order ?? 0, isCorrect: Boolean(c.isCorrect) },
            });
          } else {
            await tx.choice.create({
              data: {
                questionId: question.id,
                text: c.text,
                order: c.order ?? 0,
                isCorrect: Boolean(c.isCorrect),
              },
            });
          }
        }
      }

      return tx.question.findUnique({
        where: { id: question.id },
        include: { choices: { orderBy: { order: "asc" } } },
      });
    });

    if (!updated) return jsonError("Question not found.", { status: 404, headers });
    return jsonOk({ ok: true, question: updated }, { headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unable to update question.";
    const status = msg.includes("not found") ? 404 : 400;
    return jsonError(msg, { status, headers });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return jsonError("Forbidden.", { status: 403 });

  const rl = rateLimit({ key: `admin:question:delete:${admin.userId}`, limit: 120, windowMs: 60_000 });
  const headers = rateHeaders(rl);
  if (!rl.ok) return jsonError("Too many requests.", { status: 429, headers });

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return jsonError("id is required.", { status: 400, headers });

  try {
    await prisma.question.delete({ where: { id: body.id } });
    return jsonOk({ ok: true }, { headers });
  } catch {
    return jsonError("Unable to delete question (may have existing answers).", { status: 409, headers });
  }
}
