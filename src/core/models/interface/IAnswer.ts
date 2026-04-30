export interface IAnswer {
  answerable: "YES" | "NO";
  next_action_type: "CLICK" | "HOVER" | "ZOOM" | "NO_ACTION"; // the type of action you need to do
  target_action_id: string;
  targetIndex: number;
  reason: string;
}