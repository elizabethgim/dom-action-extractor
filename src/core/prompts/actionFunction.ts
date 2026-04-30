export function getActionInferPrompt(actions: string){
  return `
  What is the meaning of this callback fucntion of D3.js?
  This is extracted from <svg> tag.
  
  ${actions}
  `;
}