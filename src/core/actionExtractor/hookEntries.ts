import type { ListenerInfo } from "@core/models/types/ListenerInfo";
import { getHookRegistry } from "./hook";

type Listener = EventListenerOrEventListenerObject;

function normalizeSource(text: string, max=160){
    return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function getListenerName(listener: Listener): string{
    if(typeof listener ==="function"){
      return listener.name || "(anonymous)";
    }

    if (
      typeof listener ==="object" &&
      listener !== null &&
      "handleEvent" in listener &&
      typeof listener.handleEvent === "function"
    ){

      return listener.handleEvent.name || "handleEvent";
    }

    return "(unknown)";
}


function getListenerSource(listener: Listener): string {
  try{
    if (typeof listener === "function") {
      return normalizeSource(listener.toString());
    }
    return "[unavailable]";
  } catch {
    return "[unavailable]";
  }
}

function getHandlerType(listener: Listener): "function" | "object" {
  return typeof listener === "function" ? "function" : "object";
}

export function getHookEntries(el: Element) : ListenerInfo[] {
  const registry = getHookRegistry();
  const eventMap = registry.get(el);
  if(!eventMap) return [];

  const result: ListenerInfo[] = [];

  for (const [eventType, listeners] of Object.entries(eventMap)){
    if(!listeners) continue;

    for(const listener of listeners){
      result.push({
        eventType,
        handlerType: getHandlerType(listener),
        name: getListenerName(listener),
        source: getListenerSource(listener),
      })
    }
  }

  return result;
}