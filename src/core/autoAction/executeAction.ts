import type { IActions } from "../models/interface/IActions";
import { autoClick } from "./autoClick";
import { autoDoubleClick } from "./autoDoubleClick";
import { autoWheel } from "./autoWheel";
import { autoHover } from "./autoHover";

export async function executeAction(chosen: IActions) {
  if(chosen == null) return;
  console.log("Execute: ", chosen.actionType);

  switch(chosen.actionType){
    case "click":
      await autoClick(chosen.element);
      break;
    case "dbclick":
      console.log("double click executed");
      await autoDoubleClick(chosen.element);
      break;
    case "zoom":
      await autoWheel(chosen.element, -5000);
      break;
    case "hover":
      await autoHover(chosen.element);
      break;
  }
}