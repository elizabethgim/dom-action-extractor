
export type ChartAdapter = {
  id: string;
  mount(container: HTMLElement): Promise<void>;
};