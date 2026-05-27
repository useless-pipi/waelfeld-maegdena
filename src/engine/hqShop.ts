import equipmentData from '../data/equipment.json';
import type { Equipment } from '../types/equipment';

/**
 * Maps equipment ID → minimum Radio Center level required to see it in the shop.
 * Items not listed here will never appear in the HQ shop.
 *
 * Rarity ↔ Radio Center level gate:
 *   Common (1)      → Lv 1–2   (maxRarity = ceil(tier/2) = 1)
 *   Uncommon (2)    → Lv 3–4   (maxRarity = 2)
 *   Rare (3)        → Lv 5–6   (maxRarity = 3)
 *   Very Rare (4)   → Lv 7–8   (maxRarity = 4)
 *   Legendary (5)   → Lv 9–10  (maxRarity = 5)
 */
export const SHOP_TIER_MAP: Record<string, number> = {
  // ── Rarity 1 / Common (Radio Lv 1+) ────────────────────────────────────────
  basic_rifle: 1, pistol_basic: 1,
  healing_potion: 1, field_rations: 1,
  iron_helmet: 1, leather_vest: 1, combat_boots: 1,
  spyglass: 1,
  // NEW common weapons/items
  field_shotgun: 1, field_smg: 1, basic_sniper: 1, scouting_kit: 1,

  // ── Rarity 2 / Uncommon (Radio Lv 3+) ──────────────────────────────────────
  marksman_rifle: 3, scoped_rifle: 3, shotgun: 3, medal_of_bravery: 3,
  long_rifle: 3, combat_smg: 3,
  // NEW uncommon
  field_sniper: 3, field_boots_standard: 3,

  // ── Rarity 3 / Rare (Radio Lv 5+) ──────────────────────────────────────────
  scout_scope: 5, reinforced_vest: 5, steel_helmet: 5, pistol_standard: 5,
  tactical_shotgun: 5, combat_plate: 5, tactical_smg: 5, sturdy_legguards: 5,
  battle_rifle: 5, hunter_rifle: 5, pistol_tactical: 5,
  thermal_goggles: 5, heavy_assault_boots: 5, tactical_plate: 5,
  stalker_smg: 5, combat_shotgun: 5, tactical_sniper: 5,
  // NEW rare
  assault_cannon: 5, combat_optics: 5,

  // ── Rarity 4 / Very Rare (Radio Lv 7+) ──────────────────────────────────────
  heavy_machine_gun: 7, pistol_elite: 7,
  sniper_scope_mkii: 7, fieldwork_boots: 7,
  ironclad_shotgun: 7, reaper_smg: 7, commanders_seal: 7,
  phantom_sniper: 7, void_armor: 7, shadowveil_cloak: 7,
  // NEW very rare
  tactical_visor: 7,

  // ── Rarity 5 / Legendary (Radio Lv 9+) ──────────────────────────────────────
  annihilator: 9, eclipse_rifle: 9, aegis_plate: 9, valkyrie_crown: 9, pistol_void: 9,
  // NEW legendary
  siege_shotgun: 9, tempest_smg: 9, battle_greaves: 9,
};

const _allEquip = equipmentData as Equipment[];

/**
 * Items eligible for the HQ shop at a given Radio Center level.
 * Double-gated: shopTier (from SHOP_TIER_MAP) AND rarityValue <= ceil(level/2).
 */
export function getShopPool(radioCenterLevel: number): Equipment[] {
  const maxRarity = Math.ceil(radioCenterLevel / 2); // 1→1, 3→2, 5→3, 7→4, 9→5
  return _allEquip.filter(e => {
    if (e.faction) return false;
    const tier = SHOP_TIER_MAP[e.id];
    if (!tier) return false;
    if (tier > radioCenterLevel) return false;
    // Also enforce rarityValue cap so the two systems stay aligned
    if (e.rarityValue && e.rarityValue > maxRarity) return false;
    return true;
  });
}

/**
 * How many weapons and non-weapon slots appear in the shop by Radio Center level.
 *   Lv 1–3  → 1 weapon + 2 other
 *   Lv 4–5  → 2 weapon + 3 other
 *   Lv 6–7  → 3 weapon + 4 other
 *   Lv 8–10 → 4 weapon + 5 other
 */
function shopSlotCounts(level: number): { weapons: number; others: number } {
  if (level >= 8) return { weapons: 4, others: 5 };
  if (level >= 6) return { weapons: 3, others: 4 };
  if (level >= 4) return { weapons: 2, others: 3 };
  return { weapons: 1, others: 2 };
}

/**
 * Weighted random pick without replacement.
 * Items at higher rarityValue get exponentially more weight:
 *   weight = 2^(rarityValue - 1)
 * This means at max rarity R the highest tier is ~50% of total weight;
 * outdated lower-rarity items shrink to a small tail as the shop levels up.
 */
function weightedPick<T extends { rarityValue?: number }>(pool: T[], n: number): T[] {
  const result: T[] = [];
  const remaining = [...pool];

  for (let i = 0; i < n && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, e) => sum + Math.pow(2, (e.rarityValue ?? 1) - 1), 0);
    let roll = Math.random() * totalWeight;
    let chosen = remaining[remaining.length - 1]; // fallback
    for (let j = 0; j < remaining.length; j++) {
      roll -= Math.pow(2, (remaining[j].rarityValue ?? 1) - 1);
      if (roll <= 0) { chosen = remaining[j]; break; }
    }
    result.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);
  }
  return result;
}

/**
 * Generate shop item IDs scaled by Radio Center level:
 *   Lv 1–3  → 1 weapon + 2 other (3 total)
 *   Lv 4–5  → 2 weapon + 3 other (5 total)
 *   Lv 6–7  → 3 weapon + 4 other (7 total)
 *   Lv 8–10 → 4 weapon + 5 other (9 total)
 *
 * Higher-rarity items are weighted exponentially more likely to appear
 * (weight = 2^(rarityValue-1)), so low-rarity gear fades out as the shop levels up.
 */
export function generateHQShopItems(radioCenterLevel: number): string[] {
  const pool = getShopPool(radioCenterLevel);
  const weapons = pool.filter(e => e.slot === 'weapon');
  const others  = pool.filter(e => e.slot !== 'weapon');
  const { weapons: wCount, others: oCount } = shopSlotCounts(radioCenterLevel);

  const pickedWeapons = weightedPick(weapons, wCount);
  const pickedOthers  = weightedPick(others,  oCount);

  return [...pickedWeapons, ...pickedOthers].map(e => e.id);
}
