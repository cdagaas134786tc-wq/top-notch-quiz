"use client";

import { useState } from "react";

type ApiError = { ok: false; error: { message: string } };

type ApiOk = { ok: true; user: { id: string; email: string; role: string } };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const msg = (json as ApiError | null)?.error?.message ?? "Request failed";
    throw new Error(msg);
  }
  return json as T;
}

export function RegisterForm() {
  const [name, setName] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          await postJson<ApiOk>("/api/auth/register", {
            name: name.trim() || undefined,
            adminCode: adminCode.trim() || undefined,
            email: email.trim(),
            password,
          });

          window.location.href = "/auth/login?registered=1";
        } catch (err) {
          setError(err instanceof Error ? err.message : "Registration failed");
        } finally {
          setPending(false);
        }
      }}
    >
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      ) : null}

      <label className="block">
        <span className="text-sm">Name (optional)</span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          autoComplete="name"
        />
      </label>

      <label className="block">
        <span className="text-sm">Admin code (optional)</span>
        <input
          name="adminCode"
          value={adminCode}
          onChange={(e) => setAdminCode(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          autoComplete="off"
        />
      </label>

      <label className="block">
        <span className="text-sm">Email</span>
        <input
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          autoComplete="email"
        />
      </label>

      <label className="block">
        <span className="text-sm">Password</span>
        <input
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          autoComplete="new-password"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create account"}
      </button>

      <p className="text-sm text-neutral-600">
        Already have an account?{" "}
        <a className="underline" href="/auth/login">
          Sign in
        </a>
      </p>
    </form>
  );
}
