import equipmentData from '../data/equipment.json';
import type { Equipment } from '../types/equipment';

/**
 * Maps equipment ID → minimum Radio Center level required to see it in the shop.
 * Items not listed here will never appear in the HQ shop.
 */
export const SHOP_TIER_MAP: Record<string, number> = {
  // ── Tier 1: basic field gear ────────────────────────────────────────────────
  basic_rifle: 1,
  healing_potion: 1,
  field_rations: 1,
  iron_helmet: 1,
  leather_vest: 1,
  combat_boots: 1,
  spyglass: 1,

  // ── Tier 2: improved standard issue ────────────────────────────────────────
  marksman_rifle: 2,
  shotgun: 2,
  medal_of_bravery: 2,

  // ── Tier 3: professional grade ──────────────────────────────────────────────
  scout_scope: 3,
  reinforced_vest: 3,
  steel_helmet: 3,

  // ── Tier 4: mid-tier specialist gear ────────────────────────────────────────
  long_rifle: 4,
  combat_smg: 4,
  sturdy_legguards: 4,
  tactical_smg: 4,
  combat_plate: 4,

  // ── Tier 5: heavy field equipment ───────────────────────────────────────────
  light_machine_gun: 5,
  battle_rifle: 5,
  thermal_goggles: 5,
  heavy_assault_boots: 5,

  // ── Tier 6: elite assault gear ──────────────────────────────────────────────
  tactical_plate: 6,
  stalker_smg: 6,

  // ── Tier 7: advanced tactical ───────────────────────────────────────────────
  heavy_machine_gun: 7,
  sniper_scope_mkii: 7,
  fieldwork_boots: 7,

  // ── Tier 8: rare HQ supply ──────────────────────────────────────────────────
  ironclad_shotgun: 8,
  reaper_smg: 8,
  commanders_seal: 8,

  // ── Tier 9: legendary gear ──────────────────────────────────────────────────
  phantom_sniper: 9,
  void_armor: 9,
  shadowveil_cloak: 9,

  // ── Tier 10: game-changing epic equipment ────────────────────────────────────
  annihilator: 10,
  eclipse_rifle: 10,
  aegis_plate: 10,
  valkyrie_crown: 10,
};

const _allEquip = equipmentData as Equipment[];

/** Items eligible for the HQ shop at a given Radio Center level (no faction restriction). */
export function getShopPool(radioCenterLevel: number): Equipment[] {
  return _allEquip.filter(e => {
    if (e.faction) return false;
    const tier = SHOP_TIER_MAP[e.id];
    if (!tier) return false;
    return tier <= radioCenterLevel;
  });
}

/**
 * Generate exactly 3 shop item IDs:
 *   • 1 guaranteed weapon
 *   • 2 other items (any non-weapon slot)
 * If the pool is too thin, fills from whatever is available.
 */
export function generateHQShopItems(radioCenterLevel: number): string[] {
  const pool = getShopPool(radioCenterLevel);
  const weapons = pool.filter(e => e.slot === 'weapon');
  const others  = pool.filter(e => e.slot !== 'weapon');

  if (weapons.length === 0) {
    // Shouldn't happen after tier 1, but handle gracefully
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(e => e.id);
  }

  // Pick 1 random weapon
  const weapon = weapons[Math.floor(Math.random() * weapons.length)];

  // Shuffle others and pick 2 (avoid duplicates)
  const shuffledOthers = [...others].sort(() => Math.random() - 0.5);
  const picked = shuffledOthers.slice(0, 2);

  return [weapon.id, ...picked.map(e => e.id)];
}
