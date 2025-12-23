import { RegisterForm } from "./RegisterForm";

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

      <RegisterForm />
    </main>
  );
}
