export function getEffectPrompt(callbackFunction: string){
  return `
    What kind of effect happens if the current function operates?
    ${callbackFunction}
  `
}