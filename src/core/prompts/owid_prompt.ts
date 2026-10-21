export type OwidDataAnswer = {
  answerable: "YES" | "NO";
  answer: string;
  reasoning: string;
};

// Folded into the question text passed to the existing AI Runner loop
// (decideNextAction/generatePrompt), so the model gets the chart's real
// data table alongside the question without us touching that prompt code.
export function embedOwidData(question: string, dataText: string): string {
  return `${question}

(Full underlying data table for this chart, one row per line, columns separated by tabs — use these real numbers instead of guessing from the chart image:)
${dataText}`;
}

// OWID dashboards render their full dataset into a #data-table (every
// country/year, not just what the active tab shows), so the AI can be given
// the real numbers instead of having to read them off a screenshot.
export function generateOwidPrompt(chartTitle: string, question: string, dataText: string): string {
  return `You are a Chart Question and Answering assistant for the OurWorldInData chart "${chartTitle}".

You are given the full underlying data table for this chart (every row, not just what is currently visible), so you can answer precisely using the real numbers instead of guessing from an image.

Question: ${question}

Data (one row per line, columns separated by tabs):
${dataText}

Task:
1. Answer the question using only the data above.
2. If the data does not contain enough information to answer, say so.

Respond with JSON only:
{
  "answerable": "YES" | "NO",
  "answer": string,
  "reasoning": string
}`;
}
