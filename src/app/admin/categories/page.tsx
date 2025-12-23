"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { ok: true; categories: Category[] };

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

export default function AdminCategoriesPage() {
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const listQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => apiJson<ListResponse>("/api/admin/category"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiJson<{ ok: true }>("/api/admin/category", {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      }),
    onSuccess: async () => {
      setName("");
      setSlug("");
      await qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; slug: string }) =>
      apiJson<{ ok: true }>("/api/admin/category", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiJson<{ ok: true }>("/api/admin/category", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
  });

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Categories</h1>
          <p className="mt-1 text-sm text-neutral-600">CRUD categories (admin-only).</p>
        </div>
        <a className="text-sm underline" href="/admin">
          Back
        </a>
      </div>

      <section className="mt-6 rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Create category</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm">Slug</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {createMutation.isPending ? "Creating…" : "Create"}
        </button>

        {createMutation.isError ? (
          <p className="mt-3 text-sm text-red-700">{String(createMutation.error.message)}</p>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Existing</h2>

        {listQuery.isLoading ? (
          <p className="mt-2 text-sm text-neutral-600">Loading…</p>
        ) : listQuery.isError ? (
          <p className="mt-2 text-sm text-red-700">{String(listQuery.error.message)}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {(listQuery.data?.categories ?? []).map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                onSave={(payload) => updateMutation.mutate(payload)}
                onDelete={() => deleteMutation.mutate(c.id)}
                busy={updateMutation.isPending || deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function CategoryRow({
  category,
  onSave,
  onDelete,
  busy,
}: {
  category: Category;
  onSave: (payload: { id: string; name: string; slug: string }) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">Slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave({ id: category.id, name, slug })}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
