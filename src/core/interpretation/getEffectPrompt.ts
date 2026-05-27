/**
 * Returns the prompt used to ask the AI what visual effect an action produced.
 * Pass the before/after images alongside this prompt via sendToAIPost.
 * Expected AI response: JSON `{ "effect": "..." }`
 */
export function getEffectPrompt(actionType: string, targetIndex?: number | null): string {
  const actionLine =
    targetIndex != null
      ? `Action performed: ${actionType} on element index ${targetIndex}.`
      : `Action performed: ${actionType}.`;

  return `You are analyzing the visual effect of a user interaction on an interactive chart.
The first image shows the chart BEFORE the action, and the second image shows the chart AFTER the action.
${actionLine}

Describe in one or two sentences what visual change occurred as a result of this action.
Be specific about what changed (e.g. tooltip appeared, element highlighted, chart zoomed, data filtered, etc.).
Output JSON only: { "effect": "..." }`;
}
