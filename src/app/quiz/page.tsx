import { QuizPaper } from "./QuizPaper";

export default function QuizPage({
  searchParams,
}: {
  searchParams?: { id?: string };
}) {
  const quizId = searchParams?.id;

  if (!quizId) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Quiz</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Open a quiz with <span className="font-mono">/quiz?id=&lt;quizId&gt;</span>.
        </p>
      </main>
    );
  }

  return <QuizPaper quizId={quizId} />;
}
