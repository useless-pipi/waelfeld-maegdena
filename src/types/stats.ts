/** Core six base stats — values 1-20 */
export interface Stats {
  strength: number;
  dexterity: number;
  constitution: number;
  strategy: number;
  awareness: number;
  charm: number;
}

/** Bonus descriptor attached to equipment / qualifications */
export interface Bonus {
  label: string;
  /** Numeric value, e.g. +5, -4.3 */
  value: number;
  /** e.g. "hp", "hitRate", "dodge", "awareness" */
  stat: string;
  /** percentage modifier or flat */
  isPercent: boolean;
}

/** A tag instance on a maiden or enemy — references a TagDef by id */
export interface Tag {
  id: string;
}

/** Full tag definition stored in tags.json */
export interface TagDef {
  id: string;
  name: string;
  description: string;
  bonuses: Bonus[];
  ability: string | null;
  category?: 'positive' | 'double_edged' | 'negative' | string;
  isRecruit?: boolean;
}

/** Temporary in-combat status stack */
export interface StatusEffect {
  id: string;
  name: string;
  stacks: number;
  /** description of effect */
  description: string;
}
