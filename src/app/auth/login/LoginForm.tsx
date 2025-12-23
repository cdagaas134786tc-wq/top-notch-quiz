"use client";

import { getProviders, signIn } from "next-auth/react";
import { useEffect, useState } from "react";

export function LoginForm({ registered }: { registered: boolean }) {

  const [googleEnabled, setGoogleEnabled] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const providers = await getProviders();
      if (cancelled) return;
      setGoogleEnabled(Boolean(providers?.google));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!result?.ok) {
      setError("Invalid email or password.");
      return;
    }

    window.location.href = "/quiz";
  }

  return (
    <div className="mt-6">
      {registered ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Account created. Please sign in.
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="text-sm">Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            autoComplete="current-password"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div className="space-y-3">
          {googleEnabled ? (
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/quiz" })}
              className="w-full rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium"
            >
              Continue with Google
            </button>
          ) : null}

          <p className="text-sm text-neutral-600">
            No account?{" "}
            <a className="underline" href="/auth/register">
              Create one
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
