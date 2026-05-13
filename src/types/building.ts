export type BuildingCategory = 'housing' | 'medical' | 'production' | 'support' | 'research';

export interface BuildingLevel {
  level: number;
  costMoney: number;
  costWood: number;
  costMetal: number;
  description: string;
  /** Effect key handled in base engine */
  effectKey?: string;
  /** e.g. {bedCapacity: 20} */
  effectValue?: Record<string, number>;
}

export interface Building {
  id: string;
  name: string;
  category: BuildingCategory;
  description: string;
  currentLevel: number;
  maxLevel: number;
  levels: BuildingLevel[];
  isConstructed: boolean;
  /** Buildings that must be constructed before this one */
  prerequisites: string[];
}
