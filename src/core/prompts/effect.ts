export function getEffectPrompt(callbackFunction: string){
  return `
    What kind of effect happens if the current function operates?
    ${callbackFunction}
  `
}

export function getEffect(){
  const effectPrompt = `You are analyzing the visual effect of a user interaction on an interactive chart.
The first image shows the chart BEFORE the action, and the second image shows the chart AFTER the action.
Action performed: ${parsed.type} on element index ${parsed.targetIndex}.

Describe in one or two sentences what visual change occurred as a result of this action.
Be specific about what changed (e.g. tooltip appeared, element highlighted, chart zoomed, data filtered, etc.).
Output JSON only: { "effect": "..." }`;

  return effectPrompt;
}