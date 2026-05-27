/**
 * Pre-defined Lyssa enemy profiles.
 * imgId range 1001–1030 (enemy/lyssa portraits).
 * Each entry must have exactly: 3 positive + 2 double_edged + 1 negative tags, plus {id:'lyssa'}.
 *
 * Quality distribution (total 30):
 *   Q4 × 3  : lyssa_01–lyssa_03   — Sentinels / Scouts (entry-level threat)
 *   Q5 × 3  : lyssa_04–lyssa_06   — Trackers / Enforcers
 *   Q6 × 4  : lyssa_07–lyssa_10   — Guards / Raiders
 *   Q7 × 5  : lyssa_11–lyssa_15   — Wardens / Captains
 *   Q8 × 6  : lyssa_16–lyssa_21   — Champions / Commanders
 *   Q9 × 5  : lyssa_22–lyssa_26   — Overlords / Fortresses
 *   Q10 × 4 : lyssa_27–lyssa_30   — Apex / Supreme Commanders
 *
 * Stat targets (STR+DEX+CON+AWR avg): Q4≈10, Q5≈11.5, Q6≈12.75, Q7≈14, Q8≈15.5, Q9≈16.75, Q10≈18
 */

export interface LyssaDef {
  id: string;
  name: string;
  imgId: number;
  /** Explicit combat quality 4–10. Used directly by pickLyssaForQuality and createLyssaEnemy. */
  quality: number;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    strategy: number;
    awareness: number;
    charm: number;
  };
  /** {id:'lyssa'} + 3 positive + 2 double_edged + 1 negative tag ids */
  tags: { id: string }[];
}

export const LYSSA_DEFINITIONS: LyssaDef[] = [
  // ── Q4 × 3 : Sentinels / Scouts ──────────────────────────────────────────
  {
    id: 'lyssa_01', name: 'Morrigan', imgId: 1001, quality: 4,
    stats: { strength: 10, dexterity: 9,  constitution: 12, strategy: 8,  awareness: 9,  charm: 4 },
    tags: [{ id: 'lyssa' }, { id: 'warden' }, { id: 'dangerous' }, { id: 'veteran' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_02', name: 'Caelia', imgId: 1002, quality: 4,
    stats: { strength: 9,  dexterity: 10, constitution: 11, strategy: 8,  awareness: 10, charm: 4 },
    tags: [{ id: 'lyssa' }, { id: 'shadow' }, { id: 'assassin' }, { id: 'captain' }, { id: 'berserk' }, { id: 'angry' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_03', name: 'Vyndra', imgId: 1003, quality: 4,
    stats: { strength: 11, dexterity: 8,  constitution: 13, strategy: 7,  awareness: 8,  charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'enforcer' }, { id: 'guard' }, { id: 'sergeant' }, { id: 'overconfident' }, { id: 'impulsive' }, { id: 'wounded' }],
  },

  // ── Q5 × 3 : Trackers / Enforcers ────────────────────────────────────────
  {
    id: 'lyssa_04', name: 'Thessia', imgId: 1004, quality: 5,
    stats: { strength: 10, dexterity: 11, constitution: 13, strategy: 9,  awareness: 12, charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'spire' }, { id: 'rampart' }, { id: 'dangerous' }, { id: 'berserk' }, { id: 'paranoid' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_05', name: 'Brynna', imgId: 1005, quality: 5,
    stats: { strength: 11, dexterity: 10, constitution: 14, strategy: 9,  awareness: 11, charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'jailor' }, { id: 'warden' }, { id: 'veteran' }, { id: 'angry' }, { id: 'reckless' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_06', name: 'Maraen', imgId: 1006, quality: 5,
    stats: { strength: 9,  dexterity: 12, constitution: 12, strategy: 10, awareness: 12, charm: 4 },
    tags: [{ id: 'lyssa' }, { id: 'captain' }, { id: 'raider' }, { id: 'guard' }, { id: 'overconfident' }, { id: 'angry' }, { id: 'timid' }],
  },

  // ── Q6 × 4 : Guards / Raiders ─────────────────────────────────────────────
  {
    id: 'lyssa_07', name: 'Lyrel', imgId: 1007, quality: 6,
    stats: { strength: 12, dexterity: 11, constitution: 15, strategy: 10, awareness: 12, charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'assassin' }, { id: 'shadow' }, { id: 'dangerous' }, { id: 'paranoid' }, { id: 'berserk' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_08', name: 'Sarwen', imgId: 1008, quality: 6,
    stats: { strength: 10, dexterity: 12, constitution: 14, strategy: 10, awareness: 14, charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'warden' }, { id: 'sergeant' }, { id: 'picket' }, { id: 'impulsive' }, { id: 'reckless' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_09', name: 'Deritha', imgId: 1009, quality: 6,
    stats: { strength: 13, dexterity: 10, constitution: 15, strategy: 9,  awareness: 13, charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'guard' }, { id: 'captain' }, { id: 'dangerous' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_10', name: 'Fynnara', imgId: 1010, quality: 6,
    stats: { strength: 11, dexterity: 12, constitution: 15, strategy: 9,  awareness: 13, charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'enforcer' }, { id: 'raider' }, { id: 'sergeant' }, { id: 'angry' }, { id: 'paranoid' }, { id: 'anxious' }],
  },

  // ── Q7 × 5 : Wardens / Captains ──────────────────────────────────────────
  {
    id: 'lyssa_11', name: 'Eryndel', imgId: 1011, quality: 7,
    stats: { strength: 14, dexterity: 12, constitution: 17, strategy: 11, awareness: 13, charm: 6 },
    tags: [{ id: 'lyssa' }, { id: 'champion' }, { id: 'boss' }, { id: 'enforcer' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_12', name: 'Valdris', imgId: 1012, quality: 7,
    stats: { strength: 13, dexterity: 13, constitution: 16, strategy: 12, awareness: 14, charm: 6 },
    tags: [{ id: 'lyssa' }, { id: 'commander' }, { id: 'captain' }, { id: 'dangerous' }, { id: 'angry' }, { id: 'reckless' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_13', name: 'Seraphel', imgId: 1013, quality: 7,
    stats: { strength: 12, dexterity: 14, constitution: 16, strategy: 11, awareness: 14, charm: 6 },
    tags: [{ id: 'lyssa' }, { id: 'shadow' }, { id: 'assassin' }, { id: 'dangerous' }, { id: 'berserk' }, { id: 'paranoid' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_14', name: 'Korindra', imgId: 1014, quality: 7,
    stats: { strength: 15, dexterity: 11, constitution: 18, strategy: 10, awareness: 12, charm: 6 },
    tags: [{ id: 'lyssa' }, { id: 'fortress' }, { id: 'rampart' }, { id: 'champion' }, { id: 'overconfident' }, { id: 'impulsive' }, { id: 'timid' }],
  },
  {
    id: 'lyssa_15', name: 'Aelindra', imgId: 1015, quality: 7,
    stats: { strength: 14, dexterity: 13, constitution: 17, strategy: 12, awareness: 12, charm: 7 },
    tags: [{ id: 'lyssa' }, { id: 'jailor' }, { id: 'warden' }, { id: 'commander' }, { id: 'berserk' }, { id: 'angry' }, { id: 'sloppy' }],
  },

  // ── Q8 × 6 : Champions / Commanders ──────────────────────────────────────
  {
    id: 'lyssa_16', name: 'Naeveth', imgId: 1016, quality: 8,
    stats: { strength: 15, dexterity: 14, constitution: 18, strategy: 12, awareness: 15, charm: 7 },
    tags: [{ id: 'lyssa' }, { id: 'captain' }, { id: 'veteran' }, { id: 'assassin' }, { id: 'paranoid' }, { id: 'reckless' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_17', name: 'Thissara', imgId: 1017, quality: 8,
    stats: { strength: 16, dexterity: 12, constitution: 19, strategy: 12, awareness: 14, charm: 7 },
    tags: [{ id: 'lyssa' }, { id: 'boss' }, { id: 'enforcer' }, { id: 'dangerous' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_18', name: 'Duskwren', imgId: 1018, quality: 8,
    stats: { strength: 13, dexterity: 15, constitution: 17, strategy: 13, awareness: 16, charm: 7 },
    tags: [{ id: 'lyssa' }, { id: 'spire' }, { id: 'rampart' }, { id: 'warden' }, { id: 'angry' }, { id: 'impulsive' }, { id: 'anxious' }],
  },
  {
    id: 'lyssa_19', name: 'Olyvra', imgId: 1019, quality: 8,
    stats: { strength: 15, dexterity: 14, constitution: 19, strategy: 13, awareness: 14, charm: 8 },
    tags: [{ id: 'lyssa' }, { id: 'champion' }, { id: 'commander' }, { id: 'guard' }, { id: 'berserk' }, { id: 'paranoid' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_20', name: 'Caelthra', imgId: 1020, quality: 8,
    stats: { strength: 16, dexterity: 13, constitution: 19, strategy: 13, awareness: 14, charm: 8 },
    tags: [{ id: 'lyssa' }, { id: 'overlord' }, { id: 'boss' }, { id: 'captain' }, { id: 'overconfident' }, { id: 'angry' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_21', name: 'Keldrath', imgId: 1021, quality: 8,
    stats: { strength: 14, dexterity: 15, constitution: 18, strategy: 13, awareness: 15, charm: 8 },
    tags: [{ id: 'lyssa' }, { id: 'champion' }, { id: 'overlord' }, { id: 'dangerous' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'wounded' }],
  },

  // ── Q9 × 5 : Overlords / Fortresses ──────────────────────────────────────
  {
    id: 'lyssa_22', name: 'Vraelith', imgId: 1022, quality: 9,
    stats: { strength: 16, dexterity: 15, constitution: 20, strategy: 14, awareness: 16, charm: 9 },
    tags: [{ id: 'lyssa' }, { id: 'commander' }, { id: 'assassin' }, { id: 'shadow' }, { id: 'berserk' }, { id: 'angry' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_23', name: 'Thynnara', imgId: 1023, quality: 9,
    stats: { strength: 17, dexterity: 13, constitution: 21, strategy: 13, awareness: 16, charm: 8 },
    tags: [{ id: 'lyssa' }, { id: 'overlord' }, { id: 'boss' }, { id: 'enforcer' }, { id: 'paranoid' }, { id: 'berserk' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_24', name: 'Mordivael', imgId: 1024, quality: 9,
    stats: { strength: 15, dexterity: 16, constitution: 20, strategy: 14, awareness: 16, charm: 9 },
    tags: [{ id: 'lyssa' }, { id: 'champion' }, { id: 'fortress' }, { id: 'dangerous' }, { id: 'overconfident' }, { id: 'impulsive' }, { id: 'timid' }],
  },
  {
    id: 'lyssa_25', name: 'Astraea', imgId: 1025, quality: 9,
    stats: { strength: 17, dexterity: 14, constitution: 22, strategy: 15, awareness: 14, charm: 10 },
    tags: [{ id: 'lyssa' }, { id: 'commander' }, { id: 'overlord' }, { id: 'assassin' }, { id: 'berserk' }, { id: 'paranoid' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_26', name: 'Umbrien', imgId: 1026, quality: 9,
    stats: { strength: 16, dexterity: 15, constitution: 21, strategy: 14, awareness: 15, charm: 9 },
    tags: [{ id: 'lyssa' }, { id: 'boss' }, { id: 'champion' }, { id: 'shadow' }, { id: 'angry' }, { id: 'reckless' }, { id: 'sloppy' }],
  },

  // ── Q10 × 4 : Apex / Supreme Commanders ──────────────────────────────────
  {
    id: 'lyssa_27', name: 'Soverena', imgId: 1027, quality: 10,
    stats: { strength: 18, dexterity: 14, constitution: 23, strategy: 15, awareness: 17, charm: 9 },
    tags: [{ id: 'lyssa' }, { id: 'overlord' }, { id: 'commander' }, { id: 'enforcer' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_28', name: 'Darkenna', imgId: 1028, quality: 10,
    stats: { strength: 17, dexterity: 16, constitution: 22, strategy: 15, awareness: 17, charm: 10 },
    tags: [{ id: 'lyssa' }, { id: 'champion' }, { id: 'assassin' }, { id: 'dangerous' }, { id: 'paranoid' }, { id: 'angry' }, { id: 'anxious' }],
  },
  {
    id: 'lyssa_29', name: 'Veilborn', imgId: 1029, quality: 10,
    stats: { strength: 18, dexterity: 15, constitution: 23, strategy: 15, awareness: 16, charm: 9 },
    tags: [{ id: 'lyssa' }, { id: 'overlord' }, { id: 'fortress' }, { id: 'warden' }, { id: 'berserk' }, { id: 'impulsive' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_30', name: 'Nethara', imgId: 1030, quality: 10,
    stats: { strength: 19, dexterity: 14, constitution: 24, strategy: 16, awareness: 17, charm: 11 },
    tags: [{ id: 'lyssa' }, { id: 'commander' }, { id: 'champion' }, { id: 'overlord' }, { id: 'overconfident' }, { id: 'berserk' }, { id: 'sloppy' }],
  },
];
