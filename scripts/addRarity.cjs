/**
 * addRarity.cjs — one-shot script to add rarityValue to every item in equipment.json
 * and append new items that fill coverage gaps (missing weapon types / rarity tiers).
 * Run from repo root: node scripts/addRarity.cjs
 */

const fs   = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../src/data/equipment.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// ─── Rarity map (1=Common, 2=Uncommon, 3=Rare, 4=Very Rare, 5=Legendary) ────
const RARITY = {
  // ── Common (1) – Q1-Q2 ───────────────────────────────────────────────────
  revenant_bloom: 3,       // special lore item - rare
  basic_rifle: 1, pistol_basic: 1, iron_helmet: 1, leather_vest: 1,
  combat_boots: 1, healing_potion: 1, field_rations: 1, frag_grenade: 1,
  medal_r1: 1, medal_r2: 1,
  emergency_clothes: 1, emergency_boots: 1,
  maiden_dress_standard: 1, maiden_boots_standard: 1,
  field_gloves: 1, cloth_mask: 1,
  enemy_rifle: 1, enemy_smg: 1, enemy_lmg: 1, enemy_uniform: 1,
  enemy_boots: 1, enemy_armguards: 1, enemy_mask: 1, enemy_pistol: 1,
  // NEW common
  field_shotgun: 1, field_smg: 1, basic_sniper: 1, scouting_kit: 1,

  // ── Uncommon (2) – Q3-Q5 ─────────────────────────────────────────────────
  marksman_rifle: 2, shotgun: 2, scoped_rifle: 2, pistol_standard: 2,
  tactical_shotgun: 2, spyglass: 2, reinforced_vest: 2, steel_helmet: 2,
  long_rifle: 2, combat_smg: 2, scout_scope: 2, machine_gun: 2,
  light_machine_gun: 2, medal_of_bravery: 2, medal_r3: 2, medal_r4: 2,
  concussion_grenade: 2, improved_rations: 2, field_potion: 2,
  reinforced_gauntlets: 2, combat_mask: 2,
  enemy_rifle_mk2: 2, enemy_shotgun: 2, enemy_smg_mk2: 2, enemy_lmg_mk2: 2,
  enemy_uniform_mk2: 2, enemy_boots_mk2: 2, enemy_armguards_mk2: 2,
  enemy_pistol_mk2: 2, enemy_sniper: 2,
  lyssa_armor_light: 2, lyssa_boots_light: 2, lyssa_armguards_light: 2,
  lyssa_rifle: 2, lyssa_machine_gun: 2, lyssa_pistol: 2,
  lyssa_smg: 2, lyssa_shotgun: 2, lyssa_sniper: 2,
  lyssa_acc_1: 2, lyssa_acc_2: 2, lyssa_acc_3: 2,
  lyssa_medal_1: 2, lyssa_medal_2: 2, lyssa_medal_3: 2,
  // NEW uncommon
  field_sniper: 2, field_boots_standard: 2,

  // ── Rare (3) – Q5-Q7 ─────────────────────────────────────────────────────
  battle_rifle: 3, combat_plate: 3, tactical_smg: 3, stalker_smg: 3,
  hunter_rifle: 3, combat_shotgun: 3, tactical_sniper: 3, pistol_tactical: 3,
  thermal_goggles: 3, heavy_assault_boots: 3, tactical_plate: 3,
  sturdy_legguards: 3, assault_vambraces: 3, stealth_mask: 3,
  medal_r5: 3, medal_r6: 3, medal_r7: 3,
  incendiary_grenade: 3, highgrade_rations: 3, advanced_potion: 3,
  enemy_rifle_mk3: 3, enemy_shotgun_mk3: 3, enemy_smg_mk3: 3,
  enemy_lmg_mk3: 3, enemy_uniform_mk3: 3, enemy_boots_mk3: 3,
  enemy_armguards_mk3: 3, enemy_mask_mk2: 3, enemy_sniper_mk2: 3,
  enemy_pistol_mk3: 3,
  lyssa_armor: 3, lyssa_boots: 3, lyssa_armguards: 3, lyssa_mask: 3,
  lyssa_rifle_mk2: 3, lyssa_machine_gun_mk2: 3, lyssa_smg_mk2: 3,
  lyssa_shotgun_mk2: 3, lyssa_sniper_mk2: 3, lyssa_pistol_mk2: 3,
  lyssa_acc_4: 3, lyssa_acc_5: 3, lyssa_acc_6: 3,
  lyssa_medal_4: 3, lyssa_medal_5: 3, lyssa_medal_6: 3,
  heroine_dress: 3, heroine_boots: 3, heroine_rifle: 3,
  heroine_machine_gun: 3, heroine_shotgun: 3, heroine_smg: 3,
  heroine_sniper: 3, heroine_pistol: 3,
  // NEW rare
  assault_cannon: 3, combat_optics: 3,

  // ── Very Rare (4) – Q7-Q9 ────────────────────────────────────────────────
  phantom_sniper: 4, reaper_smg: 4, ironclad_shotgun: 4, pistol_elite: 4,
  heavy_machine_gun: 4, void_armor: 4, power_gauntlets: 4, fieldwork_boots: 4,
  sniper_scope_mkii: 4, phantom_mask: 4, shadowveil_cloak: 4,
  commanders_seal: 4, medal_r8: 4, medal_r9: 4,
  void_grenade: 4, elite_rations: 4, premium_potion: 4,
  lyssa_armor_heavy: 4, lyssa_boots_heavy: 4, lyssa_armguards_heavy: 4,
  lyssa_mask_enhanced: 4, lyssa_rifle_mk3: 4, enemy_sniper_mk3: 4,
  lyssa_acc_7: 4, lyssa_acc_8: 4, lyssa_medal_7: 4, lyssa_medal_8: 4,
  void_mask: 4, titan_arms: 4,
  // NEW very rare
  tactical_visor: 4,

  // ── Legendary (5) – Q9-Q10 ───────────────────────────────────────────────
  annihilator: 5, eclipse_rifle: 5, aegis_plate: 5, valkyrie_crown: 5,
  pistol_void: 5, medal_r10: 5,
  lyssa_acc_9: 5, lyssa_acc_10: 5, lyssa_medal_9: 5, lyssa_medal_10: 5,
  // NEW legendary
  siege_shotgun: 5, tempest_smg: 5, battle_greaves: 5,
};

// Apply rarityValue to all existing items
let modified = 0;
for (const item of data) {
  const rv = RARITY[item.id];
  if (rv !== undefined) {
    item.rarityValue = rv;
    modified++;
  } else {
    // Default any unmapped item to 1
    item.rarityValue = 1;
    modified++;
  }
}
console.log(`Applied rarityValue to ${modified} existing items.`);

// ─── New items to append ─────────────────────────────────────────────────────
const newItems = [
  // ── Common (1) ────────────────────────────────────────────────────────────
  {
    id: 'field_shotgun', name: 'Field Shotgun',
    slot: 'weapon', weaponType: 'shotgun',
    rarityValue: 1, bonuses: [], damage: 16, hitRateBonus: -15,
    price: 50, shopTier: 1, weight: 7,
    description: 'A basic break-action shotgun. Simple and reliable at close range.',
    quantity: null,
  },
  {
    id: 'field_smg', name: 'Field SMG',
    slot: 'weapon', weaponType: 'smg',
    rarityValue: 1, bonuses: [], damage: 8, hitRateBonus: 5, shotsPerRound: 2,
    price: 60, shopTier: 1, weight: 4,
    description: 'A lightweight 2-burst submachine gun. Easy to use, effective at short range.',
    quantity: null,
  },
  {
    id: 'basic_sniper', name: 'Basic Sniper Rifle',
    slot: 'weapon', weaponType: 'sniper_rifle',
    rarityValue: 1, bonuses: [], damage: 14, hitRateBonus: 5,
    price: 70, shopTier: 1, weight: 10,
    description: 'An entry-level scoped rifle. Longer range than a standard rifle but lacks power.',
    quantity: null,
  },
  {
    id: 'scouting_kit', name: 'Scouting Kit',
    slot: 'accessory',
    rarityValue: 1, bonuses: [{ label: 'Awareness', value: 2, stat: 'awareness', isPercent: false }],
    price: 40, shopTier: 1, weight: 0.5,
    description: 'A basic field scouting kit with map and compass. Sharpens situational awareness.',
    quantity: null,
  },
  // ── Uncommon (2) ──────────────────────────────────────────────────────────
  {
    id: 'field_sniper', name: 'Field Sniper Rifle',
    slot: 'weapon', weaponType: 'sniper_rifle',
    rarityValue: 2, bonuses: [], damage: 20, hitRateBonus: 12,
    price: 180, shopTier: 3, weight: 12,
    description: 'A serviceable bolt-action sniper rifle issued to scout units.',
    quantity: null,
  },
  {
    id: 'field_boots_standard', name: 'Field Boots',
    slot: 'legs',
    rarityValue: 2, bonuses: [
      { label: 'HP', value: 2, stat: 'hp', isPercent: false },
      { label: 'Dexterity', value: 1, stat: 'dexterity', isPercent: false },
    ],
    price: 90, shopTier: 2, weight: 3,
    description: 'Reinforced field boots with ankle support. Better than basic combat boots.',
    quantity: null,
  },
  // ── Rare (3) ──────────────────────────────────────────────────────────────
  {
    id: 'assault_cannon', name: 'Assault Cannon',
    slot: 'weapon', weaponType: 'machine_gun',
    rarityValue: 3, bonuses: [], damage: 14, hitRateBonus: -40, shotsPerRound: 7,
    price: 420, craftable: true, craftTier: 3,
    craftCost: { money: 160, wood: 0, metal: 120 },
    weight: 22,
    description: 'A 7-round burst cannon. Each shot resolved independently — capable of shredding lightly armoured groups.',
    quantity: null,
  },
  {
    id: 'combat_optics', name: 'Combat Optics',
    slot: 'accessory',
    rarityValue: 3, bonuses: [
      { label: 'Awareness', value: 6, stat: 'awareness', isPercent: false },
      { label: 'Dexterity', value: 1, stat: 'dexterity', isPercent: false },
    ],
    price: 400, shopTier: 5, weight: 1,
    description: 'Advanced multi-lens optics. Sharply improves situational awareness and reaction speed.',
    quantity: null,
  },
  // ── Very Rare (4) ─────────────────────────────────────────────────────────
  {
    id: 'tactical_visor', name: 'Tactical Visor',
    slot: 'head',
    rarityValue: 4, isRare: true,
    bonuses: [
      { label: 'Awareness', value: 8, stat: 'awareness', isPercent: false },
      { label: 'HP', value: 4, stat: 'hp', isPercent: false },
    ],
    price: 1200, shopTier: 8, weight: 2,
    description: 'A high-tech combat visor with multiple optical modes. Outstanding threat detection.',
    quantity: null,
  },
  // ── Legendary (5) ────────────────────────────────────────────────────────
  {
    id: 'siege_shotgun', name: 'Siege Shotgun',
    slot: 'weapon', weaponType: 'shotgun',
    rarityValue: 5, isRare: true,
    bonuses: [{ label: 'Strength', value: 5, stat: 'strength', isPercent: false }],
    damage: 72, hitRateBonus: -15,
    price: 4200, shopTier: 10, weight: 16,
    description: 'A legendary HQ-engineered siege shotgun. One blast can drop even the most fortified enemy at close range.',
    quantity: null,
  },
  {
    id: 'tempest_smg', name: 'Tempest SMG',
    slot: 'weapon', weaponType: 'smg',
    rarityValue: 5, isRare: true,
    bonuses: [{ label: 'Dexterity', value: 4, stat: 'dexterity', isPercent: false }],
    damage: 22, hitRateBonus: 20, shotsPerRound: 4,
    price: 4800, shopTier: 10, weight: 8,
    description: 'A legendary 4-burst SMG with lethal accuracy. Favoured by the most agile elite operatives.',
    quantity: null,
  },
  {
    id: 'battle_greaves', name: 'Battle Greaves',
    slot: 'legs',
    rarityValue: 5, isRare: true,
    bonuses: [
      { label: 'HP', value: 8, stat: 'hp', isPercent: false },
      { label: 'Dexterity', value: 4, stat: 'dexterity', isPercent: false },
    ],
    price: 4000, shopTier: 10, weight: 6,
    description: 'Legendary HQ battle greaves. The pinnacle of leg armour — exceptional speed and protection.',
    quantity: null,
  },
];

// Check for ID collisions before appending
const existingIds = new Set(data.map(i => i.id));
const toAdd = newItems.filter(i => {
  if (existingIds.has(i.id)) {
    console.log(`  Skipping duplicate id: ${i.id}`);
    return false;
  }
  return true;
});
data.push(...toAdd);
console.log(`Appended ${toAdd.length} new items.`);

// Write back
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Done. equipment.json updated.');
