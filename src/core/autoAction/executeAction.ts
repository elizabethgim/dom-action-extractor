import type { IActions } from "../models/interface/IActions";
import { autoClick } from "./autoClick";
import { autoDoubleClick } from "./autoDoubleClick";
import { autoWheel } from "./autoWheel";
import { autoHover } from "./autoHover";

export async function executeAction(chosen: IActions) {
  if (chosen == null) return;
  console.log("Execute:", chosen.actionType, "/ raw:", chosen.eventType);

  switch (chosen.actionType) {
    case "click":
      if (chosen.eventType === "dblclick") {
        await autoDoubleClick(chosen.element);
      } else {
        await autoClick(chosen.element);
      }
      break;
    case "hover":
      await autoHover(chosen.element);
      break;
    case "zoom":
      await autoWheel(chosen.element, -1000);
      break;
  }
}
