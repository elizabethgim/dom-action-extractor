export function bindActionId(evt:string, step: number, id:number){
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const makeId = (action: string, step: number, elementIdx: number) =>
    `${action}-step${pad2(step)}-element${pad2(elementIdx)}`;
  const actionId = makeId(evt, step, id); 
  return actionId;
}