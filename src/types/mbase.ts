export interface MBase {
  name: string;
  money: number;
  food: number;
  /** Current bed capacity (from tents/buildings) */
  beds: number;
  wood: number;
  metal: number;
  /** Total maiden slots used */
  maidenCount: number;
}
