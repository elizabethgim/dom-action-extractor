import type { IDatum } from "./IDatum"

export interface IActions {
  step?: number
  num?: number
  actionId: string
  actionType: string
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
  datum: IDatum | null
}