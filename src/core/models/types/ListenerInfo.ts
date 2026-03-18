export type ListenerInfo = {
  eventType: string;
  handlerType: "function" | "object";
  name: string;
  source: string;
}