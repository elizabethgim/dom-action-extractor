import type { IDatum } from "./IDatum"
import type { D3OnEntry } from "@/core/actionExtractor/d3On"

export interface IActions {
  step?: number
  num?: number
  actionId: string
  actionType: "click" | "hover" | "zoom"
  eventType?: string
  element: Element,
  elementInfo: {
    id: string,
    className: string,
    innerHTML: string
  }
  selector?: string | null,
  text?: string,
  boundingBox?: {
    x: number,
    y: number,
    w: number,
    h: number
  },
  code?: Set<EventListenerOrEventListenerObject>,
  d3On?: D3OnEntry[],
  datum: IDatum | null
}