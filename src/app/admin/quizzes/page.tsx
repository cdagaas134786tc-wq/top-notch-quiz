"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Link from "next/link";

type Category = { id: string; name: string; slug: string };

type Quiz = {
  id: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  timeLimitSeconds: number | null;
  createdAt: string;
  categoryId: string | null;
  category: Category | null;
  _count?: { questions: number; attempts: number };
};

type ListQuizzesResponse = { ok: true; quizzes: Quiz[] };

type ListCategoriesResponse = { ok: true; categories: Category[] };

type ApiError = { ok: false; error: { message: string } };

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

export default function AdminQuizzesPage() {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | "">("");

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => apiJson<ListCategoriesResponse>("/api/admin/category"),
  });

  const quizzesQuery = useQuery({
    queryKey: ["admin", "quizzes"],
    queryFn: () => apiJson<ListQuizzesResponse>("/api/admin/quiz"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiJson<{ ok: true; quiz: Quiz }>("/api/admin/quiz", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          categoryId: categoryId || null,
          isPublished: false,
        }),
      }),
    onSuccess: async (data) => {
      setTitle("");
      setDescription("");
      setCategoryId("");
      await qc.invalidateQueries({ queryKey: ["admin", "quizzes"] });

      // Jump straight into question editor
      window.location.href = `/admin/quizzes/${data.quiz.id}`;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Quiz> & { id: string }) =>
      apiJson<{ ok: true; quiz: Quiz }>("/api/admin/quiz", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "quizzes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiJson<{ ok: true }>("/api/admin/quiz", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "quizzes"] });
    },
  });

  const categories = useMemo(() => categoriesQuery.data?.categories ?? [], [categoriesQuery.data?.categories]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c] as const)), [categories]);

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Quizzes</h1>
          <p className="mt-1 text-sm text-neutral-600">CRUD quizzes and open the question editor.</p>
        </div>
        <Link className="text-sm underline" href="/admin">
          Back
        </Link>
      </div>

      <section className="mt-6 rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Create quiz</h2>

        <div className="mt-3 grid gap-3">
          <label className="block">
            <span className="text-sm">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
              rows={3}
            />
          </label>

          <label className="block">
            <span className="text-sm">Category</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            >
              <option value="">(none)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.slug})
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {createMutation.isPending ? "Creating…" : "Create & edit questions"}
        </button>

        {createMutation.isError ? (
          <p className="mt-3 text-sm text-red-700">{String(createMutation.error.message)}</p>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Existing</h2>

        {quizzesQuery.isLoading ? (
          <p className="mt-2 text-sm text-neutral-600">Loading…</p>
        ) : quizzesQuery.isError ? (
          <p className="mt-2 text-sm text-red-700">{String(quizzesQuery.error.message)}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {(quizzesQuery.data?.quizzes ?? []).map((q) => (
              <div key={q.id} className="rounded-md border border-neutral-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{q.title}</div>
                    <div className="mt-1 text-sm text-neutral-600">
                      {q.categoryId ? categoriesById.get(q.categoryId)?.name ?? "(category)" : "(no category)"}
                      {q._count ? ` · ${q._count.questions} questions` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      onClick={() => (window.location.href = `/admin/quizzes/${q.id}`)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      onClick={() => window.open(`/quiz?id=${q.id}`, "_blank", "noopener,noreferrer")}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={q.isPublished}
                      onChange={(e) => updateMutation.mutate({ id: q.id, isPublished: e.target.checked })}
                    />
                    Published
                  </label>

                  <button
                    type="button"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (!confirm("Delete this quiz?")) return;
                      deleteMutation.mutate(q.id);
                    }}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60"
                  >
                    Delete
                  </button>

                  {updateMutation.isError ? (
                    <span className="text-sm text-red-700">{String(updateMutation.error.message)}</span>
                  ) : null}
                  {deleteMutation.isError ? (
                    <span className="text-sm text-red-700">{String(deleteMutation.error.message)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
