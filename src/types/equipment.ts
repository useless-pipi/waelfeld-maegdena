import type { Bonus } from './stats';

export type EquipmentSlot =
  | 'head'
  | 'mask'
  | 'body'
  | 'arms'
  | 'legs'
  | 'accessory'
  | 'weapon'
  | 'consumable'
  | 'medal';

/** Weapon sub-type — determines EXP bucket */
export type WeaponType = 'rifle' | 'shotgun' | 'machine_gun' | 'smg' | 'sniper_rifle' | 'pistol' | 'grenade';

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
  /**
   * Item rarity tier (1–5):
   *   1 = Common      (Q1–Q2 enemies, Radio Lv 1–2)
   *   2 = Uncommon    (Q3–Q5 enemies, Radio Lv 3–4)
   *   3 = Rare        (Q5–Q7 enemies, Radio Lv 5–6)
   *   4 = Very Rare   (Q7–Q9 enemies, Radio Lv 7–8)
   *   5 = Legendary   (Q9–Q10 enemies, Radio Lv 9–10)
   */
  rarityValue?: number;
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
   * For healing potions: fraction of max HP to restore when used in combat (e.g. 0.25 = 25%).
   * The potion is consumed automatically during a round when the wielder drops below 50% HP.
   */
  healPercent?: number;
  /**
   * For field rations: flat temporary morale bonus granted to the consumer before a stage.
   * Rations are consumed automatically at mission start when morale is low or the maiden is starved.
   */
  rationMoraleBonus?: number;
  /**
   * For field rations: flat HP bonus restored to the consumer before a stage.
   */
  rationHpBonus?: number;
  /**
   * For grenades: fraction of the alive enemy team hit by the blast radius (e.g. 0.20 = 20%).
   * A grenade replaces the normal attack turn when used.
   */
  burstPercent?: number;
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
  /**
   * If true, this item cannot be equipped to any maiden's equipment slots.
   * It lives only in the stockpile and is consumed via special interactions.
   */
  noEquip?: boolean;
  /**
   * For medal-slot items: rarity tier 1–10.
   * Higher rarity = stronger bonuses. Medals are awarded as mission rewards.
   */
  medalRarity?: number;
}
