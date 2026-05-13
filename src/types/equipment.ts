import type { Bonus } from './stats';

export type EquipmentSlot =
  | 'head'
  | 'body'
  | 'legs'
  | 'accessory'
  | 'weapon'
  | 'consumable'
  | 'medal';

/** Weapon sub-type — determines EXP bucket */
export type WeaponType = 'rifle' | 'shotgun' | 'machine_gun' | 'smg' | 'sniper_rifle' | 'pistol';

export interface Skill {
  id: string;
  name: string;
  description: string;
}

export interface Equipment {
  id: string;
  /** Unique instance ID for inventory entries (allows multiples of the same item) */
  inventoryId?: string;
  name: string;
  slot: EquipmentSlot;
  bonuses: Bonus[];
  /** Weapon-specific: base damage */
  damage?: number;
  /** Weapon-specific: hit rate bonus (flat %) */
  hitRateBonus?: number;
  description: string;
  /** Quantity for consumables */
  quantity?: number;
  /** Weapon sub-type — determines which EXP bucket is used */
  weaponType?: WeaponType;
  /** Base market price (sell = 50% of this) */
  price?: number;
  /** If true, this is a rare HQ item — displayed with red outline */
  isRare?: boolean;
  /** Minimum Radio Center level required for this item to appear in the HQ shop */
  shopTier?: number;
  /** If true, can be crafted in the Factory */
  craftable?: boolean;
  /** Factory tier level required to craft */
  craftTier?: number;
  /** Resource cost to craft */
  craftCost?: { money: number; wood: number; metal: number };
  /** Extra resource cost for HQ purchase (on top of money price) */
  hqExtraCost?: { wood?: number; metal?: number };
  /**
   * Number of shots fired per combat turn (machine gun burst).
   * Each shot rolls hit and cover independently against the same target.
   * Omit or set to 1 for single-shot weapons.
   */
  shotsPerRound?: number;
  /**
   * Faction restriction for this item.
   * 'maiden' — only usable/droppable by maiden characters
   * 'enemy'  — only issued to enemy combatants (does not appear in base stockpile)
   * 'shared' — no restriction (default for generic items)
   */
  faction?: 'maiden' | 'enemy' | 'shared';
  /**
   * Weight of this item in pounds.
   * A combatant cannot equip items whose total weight exceeds their carry capacity.
   * Carry capacity = 20 + 5 × Strength.
   */
  weight?: number;
  /**
   * If true, this inventory instance is locked by the player and cannot be sold.
   * Only meaningful on inventory instances (inventoryId set) or equipped items.
   */
  isLocked?: boolean;
}
