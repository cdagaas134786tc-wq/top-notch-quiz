"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Link from "next/link";

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE";

type Choice = { id: string; text: string; isCorrect: boolean; order: number };

type Question = {
  id: string;
  prompt: string;
  type: QuestionType;
  order: number;
  hint: string | null;
  rationale: string | null;
  choices: Choice[];
};

type Quiz = { id: string; title: string };

type ApiError = { ok: false; error: { message: string } };

function getIdFromPathname(): string {
  // /admin/quizzes/<id>
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[2] ?? "";
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const msg = (json as ApiError | null)?.error?.message ?? "Request failed";
    throw new Error(msg);
  }
  return json as T;
}

function normalizeChoices(raw: Array<{ id?: string; text: string; isCorrect: boolean }>): Array<{ id?: string; text: string; isCorrect: boolean }> {
  return raw
    .map((c) => ({ id: c.id, text: c.text.trim(), isCorrect: !!c.isCorrect }))
    .filter((c) => c.text.length > 0);
}

function validateQuestion(type: QuestionType, prompt: string, choices: Array<{ text: string; isCorrect: boolean }>): string | null {
  if (prompt.trim().length === 0) return "Prompt is required";
  if (choices.length < 2) return "At least 2 choices are required";
  const correctCount = choices.filter((c) => c.isCorrect).length;
  if (correctCount < 1) return "Mark at least 1 correct choice";
  if (type === "SINGLE_CHOICE" && correctCount !== 1) return "Single choice must have exactly 1 correct choice";
  return null;
}

export default function AdminQuizEditorPage() {
  const quizId = useMemo(() => getIdFromPathname(), []);
  const qc = useQueryClient();

  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<QuestionType>("SINGLE_CHOICE");
  const [hint, setHint] = useState("");
  const [rationale, setRationale] = useState("");
  const [choices, setChoices] = useState<Array<{ text: string; isCorrect: boolean }>>([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ]);

  const quizQuery = useQuery({
    queryKey: ["admin", "quiz", quizId],
    enabled: !!quizId,
    queryFn: () => apiJson<{ ok: true; quiz: Quiz }>(`/api/admin/quiz?id=${encodeURIComponent(quizId)}`),
  });

  const questionsQuery = useQuery({
    queryKey: ["admin", "questions", quizId],
    enabled: !!quizId,
    queryFn: () => apiJson<{ ok: true; questions: Question[] }>(`/api/admin/question?quizId=${encodeURIComponent(quizId)}`),
  });

  const createQuestionMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeChoices(choices);
      const err = validateQuestion(type, prompt, normalized);
      if (err) throw new Error(err);

      return apiJson<{ ok: true; question: Question }>("/api/admin/question", {
        method: "POST",
        body: JSON.stringify({
          quizId,
          prompt,
          type,
          hint: hint.trim() ? hint : null,
          rationale: rationale.trim() ? rationale : null,
          choices: normalized,
        }),
      });
    },
    onSuccess: async () => {
      setPrompt("");
      setHint("");
      setRationale("");
      setType("SINGLE_CHOICE");
      setChoices([
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
      ]);
      await qc.invalidateQueries({ queryKey: ["admin", "questions", quizId] });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      prompt: string;
      type: QuestionType;
      hint: string | null;
      rationale: string | null;
      choices: Array<{ id?: string; text: string; isCorrect: boolean }>;
    }) =>
      apiJson<{ ok: true; question: Question }>("/api/admin/question", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "questions", quizId] });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) =>
      apiJson<{ ok: true }>("/api/admin/question", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "questions", quizId] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (payload: { id: string; direction: "UP" | "DOWN" }) =>
      apiJson<{ ok: true }>("/api/admin/question", {
        method: "PUT",
        body: JSON.stringify({ id: payload.id, move: payload.direction }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "questions", quizId] });
    },
  });

  const quizTitle = quizQuery.data?.quiz?.title ?? "Quiz";
  const questions = (questionsQuery.data?.questions ?? []).slice().sort((a, b) => a.order - b.order);

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{quizTitle}</h1>
          <p className="mt-1 text-sm text-neutral-600">Edit questions (hint/rationale supported).</p>
        </div>
        <div className="flex items-center gap-3">
          <Link className="text-sm underline" href="/admin/quizzes">
            Back
          </Link>
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            onClick={() => window.open(`/quiz?id=${quizId}`, "_blank", "noopener,noreferrer")}
          >
            Preview
          </button>
        </div>
      </div>

      <section className="mt-6 rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Add question</h2>

        <div className="mt-3 grid gap-3">
          <label className="block">
            <span className="text-sm">Type</span>
            <select
              value={type}
              onChange={(e) => {
                const nextType = e.target.value as QuestionType;
                setType(nextType);
                if (nextType === "SINGLE_CHOICE") {
                  setChoices((prev) => {
                    const normalized = prev.map((c) => ({ ...c }));
                    const firstCorrect = normalized.findIndex((c) => c.isCorrect);
                    const keepIndex = firstCorrect >= 0 ? firstCorrect : 0;
                    return normalized.map((c, idx) => ({ ...c, isCorrect: idx === keepIndex }));
                  });
                }
              }}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            >
              <option value="SINGLE_CHOICE">Single choice</option>
              <option value="MULTIPLE_CHOICE">Multiple choice</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm">Prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
              rows={3}
            />
          </label>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Choices</div>
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                onClick={() => setChoices((prev) => [...prev, { text: "", isCorrect: false }])}
              >
                Add choice
              </button>
            </div>

            {choices.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type={type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                  name="correct"
                  checked={c.isCorrect}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setChoices((prev) =>
                      prev.map((x, i) => {
                        if (type === "SINGLE_CHOICE") return { ...x, isCorrect: i === idx };
                        return i === idx ? { ...x, isCorrect: checked } : x;
                      })
                    );
                  }}
                />
                <input
                  value={c.text}
                  onChange={(e) => {
                    const v = e.target.value;
                    setChoices((prev) => prev.map((x, i) => (i === idx ? { ...x, text: v } : x)));
                  }}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  placeholder={`Choice ${idx + 1}`}
                />
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  onClick={() =>
                    setChoices((prev) => {
                      const next = prev.filter((_, i) => i !== idx);
                      if (next.length >= 2) return next;
                      return prev;
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <label className="block">
            <span className="text-sm">Hint (optional)</span>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm">Rationale (optional)</span>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
              rows={3}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => createQuestionMutation.mutate()}
          disabled={createQuestionMutation.isPending || !quizId}
          className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {createQuestionMutation.isPending ? "Saving…" : "Add question"}
        </button>

        {createQuestionMutation.isError ? (
          <p className="mt-3 text-sm text-red-700">{String(createQuestionMutation.error.message)}</p>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Questions</h2>

        {quizQuery.isLoading || questionsQuery.isLoading ? (
          <p className="mt-2 text-sm text-neutral-600">Loading…</p>
        ) : quizQuery.isError ? (
          <p className="mt-2 text-sm text-red-700">{String(quizQuery.error.message)}</p>
        ) : questionsQuery.isError ? (
          <p className="mt-2 text-sm text-red-700">{String(questionsQuery.error.message)}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {questions.map((q, index) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={index}
                total={questions.length}
                onDelete={() => {
                  if (!confirm("Delete this question?")) return;
                  deleteQuestionMutation.mutate(q.id);
                }}
                onMoveUp={() => reorderMutation.mutate({ id: q.id, direction: "UP" })}
                onMoveDown={() => reorderMutation.mutate({ id: q.id, direction: "DOWN" })}
                onSave={(payload) => updateQuestionMutation.mutate(payload)}
                isBusy={
                  updateQuestionMutation.isPending || deleteQuestionMutation.isPending || reorderMutation.isPending
                }
              />
            ))}

            {updateQuestionMutation.isError ? (
              <p className="text-sm text-red-700">{String(updateQuestionMutation.error.message)}</p>
            ) : null}
            {deleteQuestionMutation.isError ? (
              <p className="text-sm text-red-700">{String(deleteQuestionMutation.error.message)}</p>
            ) : null}
            {reorderMutation.isError ? (
              <p className="text-sm text-red-700">{String(reorderMutation.error.message)}</p>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}

function QuestionCard(props: {
  question: Question;
  index: number;
  total: number;
  isBusy: boolean;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSave: (payload: {
    id: string;
    prompt: string;
    type: QuestionType;
    hint: string | null;
    rationale: string | null;
    choices: Array<{ id?: string; text: string; isCorrect: boolean }>;
  }) => void;
}) {
  const { question, index, total } = props;

  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(question.prompt);
  const [type, setType] = useState<QuestionType>(question.type);
  const [hint, setHint] = useState(question.hint ?? "");
  const [rationale, setRationale] = useState(question.rationale ?? "");
  const [choices, setChoices] = useState<Array<{ id?: string; text: string; isCorrect: boolean }>>(
    question.choices
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ id: c.id, text: c.text, isCorrect: c.isCorrect }))
  );

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-neutral-600">Question {index + 1}</div>
          {!editing ? <div className="mt-1 font-medium">{question.prompt}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={props.isBusy || index === 0}
            onClick={props.onMoveUp}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60"
          >
            Up
          </button>
          <button
            type="button"
            disabled={props.isBusy || index === total - 1}
            onClick={props.onMoveDown}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60"
          >
            Down
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            disabled={props.isBusy}
            onClick={props.onDelete}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className="text-sm">Type</span>
            <select
              value={type}
              onChange={(e) => {
                const nextType = e.target.value as QuestionType;
                setType(nextType);
                if (nextType === "SINGLE_CHOICE") {
                  setChoices((prev) => {
                    const normalized = prev.map((c) => ({ ...c }));
                    const firstCorrect = normalized.findIndex((c) => c.isCorrect);
                    const keepIndex = firstCorrect >= 0 ? firstCorrect : 0;
                    return normalized.map((c, idx) => ({ ...c, isCorrect: idx === keepIndex }));
                  });
                }
              }}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            >
              <option value="SINGLE_CHOICE">Single choice</option>
              <option value="MULTIPLE_CHOICE">Multiple choice</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm">Prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
              rows={3}
            />
          </label>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Choices</div>
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                onClick={() => setChoices((prev) => [...prev, { text: "", isCorrect: false }])}
              >
                Add choice
              </button>
            </div>

            {choices.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type={type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                  name={`correct-${question.id}`}
                  checked={c.isCorrect}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setChoices((prev) =>
                      prev.map((x, i) => {
                        if (type === "SINGLE_CHOICE") return { ...x, isCorrect: i === idx };
                        return i === idx ? { ...x, isCorrect: checked } : x;
                      })
                    );
                  }}
                />
                <input
                  value={c.text}
                  onChange={(e) => {
                    const v = e.target.value;
                    setChoices((prev) => prev.map((x, i) => (i === idx ? { ...x, text: v } : x)));
                  }}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                />
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  onClick={() =>
                    setChoices((prev) => {
                      const next = prev.filter((_, i) => i !== idx);
                      if (next.length >= 2) return next;
                      return prev;
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <label className="block">
            <span className="text-sm">Hint</span>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm">Rationale</span>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
              rows={3}
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={props.isBusy}
              onClick={() => {
                const normalized = normalizeChoices(choices);
                const err = validateQuestion(type, prompt, normalized);
                if (err) {
                  alert(err);
                  return;
                }
                props.onSave({
                  id: question.id,
                  prompt,
                  type,
                  hint: hint.trim() ? hint : null,
                  rationale: rationale.trim() ? rationale : null,
                  choices: normalized,
                });
              }}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
