/**
 * Pre-defined Lyssa enemy profiles.
 * imgId range 1001–1030 (enemy/lyssa portraits).
 * Each entry must have exactly: 3 positive + 2 double_edged + 1 negative tags, plus {id:'lyssa'}.
 *
 * Tier 1 (lyssa_01–lyssa_10, imgId 1001–1010): Sentinels / Scouts — moderate threat.
 * Tier 2 (lyssa_11–lyssa_20, imgId 1011–1020): Wardens / Captains — high threat.
 * Tier 3 (lyssa_21–lyssa_30, imgId 1021–1030): Champions / Overlords — extreme threat.
 */

export interface LyssaDef {
  id: string;
  name: string;
  imgId: number;
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
  // ── Tier 1: Sentinels / Scouts ────────────────────────────────────────────
  {
    id: 'lyssa_01', name: 'Morrigan', imgId: 1001,
    stats: { strength: 10, dexterity: 9,  constitution: 12, strategy: 8,  awareness: 9,  charm: 4 },
    tags: [{ id: 'lyssa' }, { id: 'warden' }, { id: 'dangerous' }, { id: 'veteran' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_02', name: 'Caelia', imgId: 1002,
    stats: { strength: 9,  dexterity: 10, constitution: 11, strategy: 8,  awareness: 10, charm: 4 },
    tags: [{ id: 'lyssa' }, { id: 'shadow' }, { id: 'assassin' }, { id: 'captain' }, { id: 'berserk' }, { id: 'angry' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_03', name: 'Vyndra', imgId: 1003,
    stats: { strength: 11, dexterity: 8,  constitution: 13, strategy: 7,  awareness: 8,  charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'enforcer' }, { id: 'guard' }, { id: 'sergeant' }, { id: 'overconfident' }, { id: 'impulsive' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_04', name: 'Thessia', imgId: 1004,
    stats: { strength: 9,  dexterity: 11, constitution: 11, strategy: 9,  awareness: 9,  charm: 4 },
    tags: [{ id: 'lyssa' }, { id: 'spire' }, { id: 'rampart' }, { id: 'dangerous' }, { id: 'berserk' }, { id: 'paranoid' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_05', name: 'Brynna', imgId: 1005,
    stats: { strength: 10, dexterity: 9,  constitution: 12, strategy: 8,  awareness: 10, charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'jailor' }, { id: 'warden' }, { id: 'veteran' }, { id: 'angry' }, { id: 'reckless' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_06', name: 'Maraen', imgId: 1006,
    stats: { strength: 8,  dexterity: 11, constitution: 10, strategy: 9,  awareness: 11, charm: 4 },
    tags: [{ id: 'lyssa' }, { id: 'captain' }, { id: 'raider' }, { id: 'guard' }, { id: 'overconfident' }, { id: 'angry' }, { id: 'timid' }],
  },
  {
    id: 'lyssa_07', name: 'Lyrel', imgId: 1007,
    stats: { strength: 11, dexterity: 10, constitution: 12, strategy: 7,  awareness: 8,  charm: 4 },
    tags: [{ id: 'lyssa' }, { id: 'assassin' }, { id: 'shadow' }, { id: 'dangerous' }, { id: 'paranoid' }, { id: 'berserk' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_08', name: 'Sarwen', imgId: 1008,
    stats: { strength: 9,  dexterity: 10, constitution: 11, strategy: 9,  awareness: 10, charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'warden' }, { id: 'sergeant' }, { id: 'picket' }, { id: 'impulsive' }, { id: 'reckless' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_09', name: 'Deritha', imgId: 1009,
    stats: { strength: 10, dexterity: 9,  constitution: 13, strategy: 8,  awareness: 9,  charm: 4 },
    tags: [{ id: 'lyssa' }, { id: 'guard' }, { id: 'captain' }, { id: 'dangerous' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_10', name: 'Fynnara', imgId: 1010,
    stats: { strength: 11, dexterity: 8,  constitution: 12, strategy: 7,  awareness: 9,  charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'enforcer' }, { id: 'raider' }, { id: 'sergeant' }, { id: 'angry' }, { id: 'paranoid' }, { id: 'anxious' }],
  },

  // ── Tier 2: Wardens / Captains ────────────────────────────────────────────
  {
    id: 'lyssa_11', name: 'Eryndel', imgId: 1011,
    stats: { strength: 12, dexterity: 11, constitution: 15, strategy: 10, awareness: 10, charm: 6 },
    tags: [{ id: 'lyssa' }, { id: 'champion' }, { id: 'boss' }, { id: 'enforcer' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_12', name: 'Valdris', imgId: 1012,
    stats: { strength: 13, dexterity: 11, constitution: 14, strategy: 11, awareness: 10, charm: 6 },
    tags: [{ id: 'lyssa' }, { id: 'commander' }, { id: 'captain' }, { id: 'dangerous' }, { id: 'angry' }, { id: 'reckless' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_13', name: 'Seraphel', imgId: 1013,
    stats: { strength: 11, dexterity: 13, constitution: 14, strategy: 10, awareness: 12, charm: 6 },
    tags: [{ id: 'lyssa' }, { id: 'shadow' }, { id: 'assassin' }, { id: 'dangerous' }, { id: 'berserk' }, { id: 'paranoid' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_14', name: 'Korindra', imgId: 1014,
    stats: { strength: 14, dexterity: 10, constitution: 16, strategy: 9,  awareness: 10, charm: 5 },
    tags: [{ id: 'lyssa' }, { id: 'fortress' }, { id: 'rampart' }, { id: 'champion' }, { id: 'overconfident' }, { id: 'impulsive' }, { id: 'timid' }],
  },
  {
    id: 'lyssa_15', name: 'Aelindra', imgId: 1015,
    stats: { strength: 13, dexterity: 12, constitution: 15, strategy: 11, awareness: 11, charm: 7 },
    tags: [{ id: 'lyssa' }, { id: 'jailor' }, { id: 'warden' }, { id: 'commander' }, { id: 'berserk' }, { id: 'angry' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_16', name: 'Naeveth', imgId: 1016,
    stats: { strength: 12, dexterity: 13, constitution: 14, strategy: 10, awareness: 12, charm: 6 },
    tags: [{ id: 'lyssa' }, { id: 'captain' }, { id: 'veteran' }, { id: 'assassin' }, { id: 'paranoid' }, { id: 'reckless' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_17', name: 'Thissara', imgId: 1017,
    stats: { strength: 14, dexterity: 11, constitution: 16, strategy: 10, awareness: 10, charm: 6 },
    tags: [{ id: 'lyssa' }, { id: 'boss' }, { id: 'enforcer' }, { id: 'dangerous' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_18', name: 'Duskwren', imgId: 1018,
    stats: { strength: 11, dexterity: 13, constitution: 14, strategy: 11, awareness: 13, charm: 6 },
    tags: [{ id: 'lyssa' }, { id: 'spire' }, { id: 'rampart' }, { id: 'warden' }, { id: 'angry' }, { id: 'impulsive' }, { id: 'anxious' }],
  },
  {
    id: 'lyssa_19', name: 'Olyvra', imgId: 1019,
    stats: { strength: 13, dexterity: 12, constitution: 15, strategy: 11, awareness: 11, charm: 7 },
    tags: [{ id: 'lyssa' }, { id: 'champion' }, { id: 'commander' }, { id: 'guard' }, { id: 'berserk' }, { id: 'paranoid' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_20', name: 'Caelthra', imgId: 1020,
    stats: { strength: 14, dexterity: 11, constitution: 17, strategy: 12, awareness: 10, charm: 7 },
    tags: [{ id: 'lyssa' }, { id: 'overlord' }, { id: 'boss' }, { id: 'captain' }, { id: 'overconfident' }, { id: 'angry' }, { id: 'demoralized' }],
  },

  // ── Tier 3: Champions / Overlords ─────────────────────────────────────────
  {
    id: 'lyssa_21', name: 'Keldrath', imgId: 1021,
    stats: { strength: 15, dexterity: 13, constitution: 18, strategy: 13, awareness: 12, charm: 8 },
    tags: [{ id: 'lyssa' }, { id: 'champion' }, { id: 'overlord' }, { id: 'dangerous' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_22', name: 'Vraelith', imgId: 1022,
    stats: { strength: 14, dexterity: 14, constitution: 17, strategy: 12, awareness: 13, charm: 8 },
    tags: [{ id: 'lyssa' }, { id: 'commander' }, { id: 'assassin' }, { id: 'shadow' }, { id: 'berserk' }, { id: 'angry' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_23', name: 'Thynnara', imgId: 1023,
    stats: { strength: 16, dexterity: 12, constitution: 19, strategy: 13, awareness: 12, charm: 7 },
    tags: [{ id: 'lyssa' }, { id: 'overlord' }, { id: 'boss' }, { id: 'enforcer' }, { id: 'paranoid' }, { id: 'berserk' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_24', name: 'Mordivael', imgId: 1024,
    stats: { strength: 15, dexterity: 13, constitution: 18, strategy: 12, awareness: 13, charm: 8 },
    tags: [{ id: 'lyssa' }, { id: 'champion' }, { id: 'fortress' }, { id: 'dangerous' }, { id: 'overconfident' }, { id: 'impulsive' }, { id: 'timid' }],
  },
  {
    id: 'lyssa_25', name: 'Astraea', imgId: 1025,
    stats: { strength: 16, dexterity: 14, constitution: 20, strategy: 14, awareness: 13, charm: 9 },
    tags: [{ id: 'lyssa' }, { id: 'commander' }, { id: 'overlord' }, { id: 'assassin' }, { id: 'berserk' }, { id: 'paranoid' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_26', name: 'Umbrien', imgId: 1026,
    stats: { strength: 14, dexterity: 15, constitution: 17, strategy: 12, awareness: 14, charm: 8 },
    tags: [{ id: 'lyssa' }, { id: 'boss' }, { id: 'champion' }, { id: 'shadow' }, { id: 'angry' }, { id: 'reckless' }, { id: 'sloppy' }],
  },
  {
    id: 'lyssa_27', name: 'Soverena', imgId: 1027,
    stats: { strength: 17, dexterity: 13, constitution: 20, strategy: 14, awareness: 12, charm: 8 },
    tags: [{ id: 'lyssa' }, { id: 'overlord' }, { id: 'commander' }, { id: 'enforcer' }, { id: 'berserk' }, { id: 'overconfident' }, { id: 'demoralized' }],
  },
  {
    id: 'lyssa_28', name: 'Darkenna', imgId: 1028,
    stats: { strength: 15, dexterity: 14, constitution: 18, strategy: 13, awareness: 14, charm: 9 },
    tags: [{ id: 'lyssa' }, { id: 'champion' }, { id: 'assassin' }, { id: 'dangerous' }, { id: 'paranoid' }, { id: 'angry' }, { id: 'anxious' }],
  },
  {
    id: 'lyssa_29', name: 'Veilborn', imgId: 1029,
    stats: { strength: 16, dexterity: 13, constitution: 21, strategy: 14, awareness: 12, charm: 8 },
    tags: [{ id: 'lyssa' }, { id: 'overlord' }, { id: 'fortress' }, { id: 'warden' }, { id: 'berserk' }, { id: 'impulsive' }, { id: 'wounded' }],
  },
  {
    id: 'lyssa_30', name: 'Nethara', imgId: 1030,
    stats: { strength: 17, dexterity: 14, constitution: 22, strategy: 15, awareness: 13, charm: 10 },
    tags: [{ id: 'lyssa' }, { id: 'commander' }, { id: 'champion' }, { id: 'overlord' }, { id: 'overconfident' }, { id: 'berserk' }, { id: 'sloppy' }],
  },
];
