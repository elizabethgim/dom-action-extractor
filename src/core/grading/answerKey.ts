// Ground-truth Q&A pairs collected from data/questions/**/questions.json
// (copied out of the d3-vis benchmark repo — see datasets/.../questions.json
// for the per-chart originals). Used to look up the expected answer for
// whichever question the AI Runner is currently being tested against.

type GradingQuestion = {
  id: string;
  question: string;
  question_type?: string;
  required_interaction?: string[];
  answer: string;
  difficulty?: string;
};

type GradingFile = {
  uuid: string;
  source: string;
  directory: string;
  chart_type: string;
  topic: string;
  questions: GradingQuestion[];
};

const modules = import.meta.glob("/data/questions/**/questions.json", {
  eager: true,
  import: "default",
}) as Record<string, GradingFile>;

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

const answerByQuestion = new Map<string, string>();
for (const file of Object.values(modules)) {
  for (const q of file.questions ?? []) {
    if (q.question && q.answer) answerByQuestion.set(normalize(q.question), q.answer);
  }
}

export function findExpectedAnswer(question: string): string | null {
  if (!question.trim()) return null;
  return answerByQuestion.get(normalize(question)) ?? null;
}
