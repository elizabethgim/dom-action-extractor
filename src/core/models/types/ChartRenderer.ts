export type ChartRenderer = {
  id?: string;
  mount: (container: HTMLElement) => void | Promise<void>;
  unmount?: (container: HTMLElement) => void | Promise<void>;
};