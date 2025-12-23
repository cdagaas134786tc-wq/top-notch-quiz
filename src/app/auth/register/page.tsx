import { registerAction } from "./actions";

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const error = searchParams?.error;
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-xl font-semibold">Create account</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Register with email and password.
      </p>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <form action={registerAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm">Name (optional)</span>
          <input
            name="name"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            autoComplete="name"
          />
        </label>

        <label className="block">
          <span className="text-sm">Admin code (optional)</span>
          <input
            name="adminCode"
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
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            autoComplete="new-password"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Create account
        </button>

        <p className="text-sm text-neutral-600">
          Already have an account?{" "}
          <a className="underline" href="/auth/login">
            Sign in
          </a>
        </p>
      </form>
    </main>
  );
}
