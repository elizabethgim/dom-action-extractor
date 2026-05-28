import { DEFAULT_EVENTS, toActionType } from "./DefaultEventType";
import type { IActions } from "../models/interface/IActions";
import { resolveActionIdFromEvent } from "./actionIdStore";

const mutationBuffer: MutationRecord[] = [];
const actionHistory: Partial<IActions>[] = [];

export async function installActionLogger(container: HTMLElement){
  const observer = new MutationObserver((entries) => {
    mutationBuffer.push(...entries);
  });

  observer.observe(container, { subtree: true, childList: true, attributes: true, characterData: true});

  const handler = async (evt: Event) => {
    const target = evt.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("svg")) return;
    
    const evtType = evt.type;
    
    const actionType = toActionType(evtType);
    if (!actionType) return;

    const action: Partial<IActions> = {
      actionType,
      element: target,
    }
    const actionId = resolveActionIdFromEvent(evt);
    
    if(actionId) action.actionId = actionId;

    actionHistory.push(action);
    console.log("[logger]", action);
  }

  for (const type of DEFAULT_EVENTS) {
    document.addEventListener(type, handler, true);
  }
  
  return {
    uninstall() {
      for (const evtType of DEFAULT_EVENTS) {
        document.removeEventListener(evtType, handler, true);
      }
      observer.disconnect();
    }
  };
}


export function getMutationBuffer() {
  return mutationBuffer;
}

export function getActionHistory(){
  return actionHistory;
}

export function addActionToHistory(action: Partial<IActions>) {
  actionHistory.push(action);
}

export function clearActionHistory() {
  actionHistory.length = 0;
}