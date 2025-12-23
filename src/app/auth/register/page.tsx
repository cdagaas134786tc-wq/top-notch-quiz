import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-xl font-semibold">Create account</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Register with email and password.
      </p>

      <RegisterForm />
    </main>
  );
}
