export interface IDOMElements{
  id: string;
  element: {
    tag: string;
    id?: string;
    className?: string;
    text?: string;
  },
  visited: boolean;
  expected_effect: string;
}