"use client";

import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

type QuizChoice = {
  id: string;
  text: string;
  order: number;
};

type QuizQuestion = {
  id: string;
  prompt: string;
  hint: string | null;
  rationale: string | null;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  order: number;
  choices: QuizChoice[];
};

type QuizPayload = {
  ok: true;
  quiz: {
    id: string;
    title: string;
    description: string | null;
    timeLimitSeconds: number | null;
    questions: QuizQuestion[];
  };
};

type SubmitResponse = {
  ok: true;
  attempt: { id: string; score: number | null; attemptNo: number };
  totalQuestions: number;
};

type LocalDraft = {
  attemptId?: string;
  answersByQuestionId: Record<string, string[]>;
};

const EMPTY_QUESTIONS: QuizQuestion[] = [];

function storageKey(quizId: string) {
  return `quiz:${quizId}:draft:v1`;
}

function loadDraft(quizId: string): LocalDraft {
  try {
    const raw = localStorage.getItem(storageKey(quizId));
    if (!raw) return { answersByQuestionId: {} };
    const parsed = JSON.parse(raw) as LocalDraft;
    if (!parsed?.answersByQuestionId || typeof parsed.answersByQuestionId !== "object") {
      return { answersByQuestionId: {} };
    }
    return {
      attemptId: parsed.attemptId,
      answersByQuestionId: parsed.answersByQuestionId,
    };
  } catch {
    return { answersByQuestionId: {} };
  }
}

function saveDraft(quizId: string, draft: LocalDraft) {
  try {
    localStorage.setItem(storageKey(quizId), JSON.stringify(draft));
  } catch {
    // ignore
  }
}

function normalizeChoices(choiceIds: string[]) {
  return Array.from(new Set(choiceIds.filter(Boolean)));
}

export function QuizPaper({ quizId }: { quizId: string }) {
  const { status } = useSession();

  const quizQuery = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async (): Promise<QuizPayload> => {
      const res = await fetch(`/api/quiz?id=${encodeURIComponent(quizId)}`);
      if (!res.ok) throw new Error("Failed to load quiz");
      return (await res.json()) as QuizPayload;
    },
  });

  const questions = quizQuery.data?.quiz.questions ?? EMPTY_QUESTIONS;
  const enableVirtualization = questions.length >= 120;

  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, string[]>>({});
  const [attemptId, setAttemptId] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load local draft once.
  useEffect(() => {
    const draft = loadDraft(quizId);
    setAttemptId(draft.attemptId);
    setAnswersByQuestionId(draft.answersByQuestionId);
  }, [quizId]);

  // Persist local draft on any answer change.
  useEffect(() => {
    saveDraft(quizId, { attemptId, answersByQuestionId });
  }, [quizId, attemptId, answersByQuestionId]);

  const flattenedAnswers = useMemo(() => {
    return Object.entries(answersByQuestionId)
      .filter(([, choiceIds]) => Array.isArray(choiceIds) && choiceIds.length > 0)
      .map(([questionId, choiceIds]) => ({
        questionId,
        choiceIds: normalizeChoices(choiceIds),
      }));
  }, [answersByQuestionId]);

  const lastSyncPayloadRef = useRef<string>("");
  const syncTimerRef = useRef<number | null>(null);

  // Best-effort backend sync when logged in.
  useEffect(() => {
    if (submitted) return;
    if (status !== "authenticated") return;
    if (!quizId) return;

    const payload = JSON.stringify({ quizId, attemptId, answers: flattenedAnswers });
    if (payload === lastSyncPayloadRef.current) return;

    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);

    syncTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/quiz/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { ok: true; attemptId: string };
        lastSyncPayloadRef.current = payload;
        if (data?.attemptId && data.attemptId !== attemptId) {
          setAttemptId(data.attemptId);
        }
      } catch {
        // ignore
      }
    }, 800);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [quizId, attemptId, flattenedAnswers, status, submitted]);

  const answeredCount = useMemo(() => {
    if (!questions.length) return 0;
    let count = 0;
    for (const q of questions) {
      const a = answersByQuestionId[q.id] ?? [];
      if (a.length > 0) count += 1;
    }
    return count;
  }, [questions, answersByQuestionId]);

  function toggleChoice(question: QuizQuestion, choiceId: string) {
    setAnswersByQuestionId((prev) => {
      const existing = prev[question.id] ?? [];

      if (question.type === "SINGLE_CHOICE") {
        return { ...prev, [question.id]: [choiceId] };
      }

      const set = new Set(existing);
      if (set.has(choiceId)) set.delete(choiceId);
      else set.add(choiceId);

      return { ...prev, [question.id]: Array.from(set) };
    });
  }

  async function onSubmit() {
    setSubmitError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quizId, attemptId, answers: flattenedAnswers }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: { message?: string } }
          | null;
        setSubmitError(j?.error?.message ?? "Failed to submit.");
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as SubmitResponse;
      setSubmitResult(data);
      setSubmitted(true);
      setSubmitting(false);
    } catch {
      setSubmitError("Failed to submit.");
      setSubmitting(false);
    }
  }

  const parentRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: questions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 10,
  });

  if (quizQuery.isLoading) {
    return (
      <main className="p-6">
        <p className="text-sm text-neutral-600">Loading quiz…</p>
      </main>
    );
  }

  if (quizQuery.isError || !quizQuery.data?.quiz) {
    return (
      <main className="p-6">
        <p className="text-sm text-red-700">Failed to load quiz.</p>
      </main>
    );
  }

  const quiz = quizQuery.data.quiz;

  const header = (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto w-full max-w-3xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">{quiz.title}</h1>
            {quiz.description ? (
              <p className="mt-1 text-sm text-neutral-600">{quiz.description}</p>
            ) : null}
            <p className="mt-2 text-xs text-neutral-600">
              Answered {answeredCount}/{questions.length}
              {status === "authenticated" ? " · Autosaving" : " · Autosave local only (sign in to sync)"}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {submitResult ? (
              <div className="text-sm">
                <div className="font-medium">Submitted</div>
                <div className="text-neutral-600">
                  Score: {submitResult.attempt.score ?? 0}/{submitResult.totalQuestions}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            )}
          </div>
        </div>

        {submitError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {submitError}
          </p>
        ) : null}
      </div>
    </header>
  );

  function QuestionCard({ q, index }: { q: QuizQuestion; index: number }) {
    const selected = new Set(answersByQuestionId[q.id] ?? []);
    const answered = selected.size > 0;

    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold">
            {index + 1}. {q.prompt}
          </h2>
          {answered ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900">
              Answered
            </span>
          ) : (
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-700">
              Unanswered
            </span>
          )}
        </div>

        {q.hint ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-neutral-700 underline">
              Show hint
            </summary>
            <p className="mt-2 text-sm text-neutral-700">{q.hint}</p>
          </details>
        ) : null}

        <div className="mt-4 space-y-2">
          {q.choices.map((c) => {
            const isSelected = selected.has(c.id);
            const inputType = q.type === "SINGLE_CHOICE" ? "radio" : "checkbox";
            return (
              <label
                key={c.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 p-3"
              >
                <input
                  type={inputType}
                  name={q.id}
                  checked={isSelected}
                  onChange={() => toggleChoice(q, c.id)}
                  disabled={submitted}
                  className="mt-1"
                />
                <span className="text-sm">{c.text}</span>
              </label>
            );
          })}
        </div>

        {(submitted || answered) && q.rationale ? (
          <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="text-xs font-medium text-neutral-700">Rationale</div>
            <div className="mt-1 text-sm text-neutral-700">{q.rationale}</div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {header}

      <main className="mx-auto w-full max-w-3xl p-4">
        {enableVirtualization ? (
          <div
            ref={parentRef}
            className="h-[calc(100vh-140px)] overflow-auto"
          >
            <div
              style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
              className="w-full"
            >
              {rowVirtualizer.getVirtualItems().map((v) => {
                const q = questions[v.index];
                return (
                  <div
                    key={q.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={v.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${v.start}px)`,
                      paddingBottom: 12,
                    }}
                  >
                    <QuestionCard q={q} index={v.index} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <QuestionCard key={q.id} q={q} index={idx} />
            ))}
          </div>
        )}

        <div className="mt-6 text-center text-xs text-neutral-600">
          {submitted ? "Submission saved." : "Your answers are saved as you go."}
        </div>
      </main>
    </div>
  );
}
