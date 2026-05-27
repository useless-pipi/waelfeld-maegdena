// ---------------------------------------------------------------------------
// Shared helpers for all persistent UI/gameplay preferences
// ---------------------------------------------------------------------------

export const SETTINGS_CHANGED_EVENT = 'wm-settings-changed';

// ── UI Scale ─────────────────────────────────────────────────────────────────
export const UI_SCALE_KEY = 'wm_ui_scale';
export const UI_SCALE_OPTIONS = [
  { value: 0.8,  label: '80% — Very small' },
  { value: 0.9,  label: '90% — Small' },
  { value: 1.0,  label: '100% — Default' },
  { value: 1.1,  label: '110% — Large' },
  { value: 1.2,  label: '120% — Larger' },
  { value: 1.3,  label: '130% — Largest' },
];

export function readUiScale(): number {
  const raw = localStorage.getItem(UI_SCALE_KEY);
  if (raw) {
    const n = parseFloat(raw);
    if (!isNaN(n) && n >= 0.7 && n <= 1.5) return n;
  }
  return 1.0;
}

export function writeUiScale(scale: number) {
  localStorage.setItem(UI_SCALE_KEY, String(scale));
  applyUiScale(scale);
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}

export function applyUiScale(scale: number) {
  (document.documentElement.style as any).zoom = String(scale);
}

// ── Battle speed (cookie) ─────────────────────────────────────────────────────
export const SPEED_COOKIE = 'wm_battle_speed';
export const BATTLE_SPEED_OPTIONS: { value: 1 | 2 | 4 | 8; label: string }[] = [
  { value: 1, label: '1× — Normal' },
  { value: 2, label: '2× — Fast' },
  { value: 4, label: '4× — Very Fast' },
  { value: 8, label: '8× — Turbo' },
];

export function readBattleSpeed(): 1 | 2 | 4 | 8 {
  const match = document.cookie.split('; ').find(r => r.startsWith(SPEED_COOKIE + '='));
  if (match) {
    const v = parseInt(match.split('=')[1], 10);
    if (v === 1 || v === 2 || v === 4 || v === 8) return v;
  }
  return 1;
}

export function writeBattleSpeed(speed: 1 | 2 | 4 | 8) {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${SPEED_COOKIE}=${speed}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

// ── Auto-equip ────────────────────────────────────────────────────────────────
export const AUTO_EQUIP_KEY = 'wm_auto_equip_v2';
export const AUTO_EQUIP_SLOTS = ['weapon','head','mask','body','arms','legs','accessory','medal','potion','ration','grenade'] as const;
export type AutoEquipSlot = typeof AUTO_EQUIP_SLOTS[number];
export type AutoEquipConfig = Record<AutoEquipSlot, boolean>;

export const AUTO_EQUIP_SLOT_LABELS: Record<AutoEquipSlot, string> = {
  weapon: '🔫 Weapon', head: '🪖 Head', mask: '🎭 Mask', body: '🧥 Body',
  arms: '🧤 Arms', legs: '👢 Legs', accessory: '🔭 Accessory',
  medal: '🎖️ Medal', potion: '💊 Potions', ration: '🍖 Rations', grenade: '💣 Grenades',
};

export function readAutoEquipConfig(): AutoEquipConfig {
  try {
    const raw = localStorage.getItem(AUTO_EQUIP_KEY);
    if (raw) return JSON.parse(raw) as AutoEquipConfig;
  } catch { /* ignore */ }
  return Object.fromEntries(AUTO_EQUIP_SLOTS.map(s => [s, false])) as AutoEquipConfig;
}

export function writeAutoEquipConfig(cfg: AutoEquipConfig) {
  localStorage.setItem(AUTO_EQUIP_KEY, JSON.stringify(cfg));
}

// ── Auto trade food ───────────────────────────────────────────────────────────
export const AUTO_TRADE_FOOD_KEY = 'autoTradeFood';

export function readAutoTradeFood(): boolean {
  const saved = localStorage.getItem(AUTO_TRADE_FOOD_KEY);
  return saved === null ? true : saved === 'true';
}

export function writeAutoTradeFood(val: boolean) {
  localStorage.setItem(AUTO_TRADE_FOOD_KEY, String(val));
}

// ── Auto-Recruit (cookie) ─────────────────────────────────────────────────────
export const AUTO_RECRUIT_COOKIE = 'wm_auto_recruit';

export function readAutoRecruit(): boolean {
  const match = document.cookie.split('; ').find(r => r.startsWith(AUTO_RECRUIT_COOKIE + '='));
  if (match) return match.split('=')[1] === 'true';
  return false;
}

export function writeAutoRecruit(val: boolean) {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${AUTO_RECRUIT_COOKIE}=${val}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

// ── Members page preferences ──────────────────────────────────────────────────
export function readMembersViewMode(): 'grid' | 'list' {
  return (localStorage.getItem('members_viewMode') as 'grid' | 'list') ?? 'grid';
}
export function writeMembersViewMode(v: 'grid' | 'list') {
  localStorage.setItem('members_viewMode', v);
}

export function readMembersShowAlive(): boolean {
  return localStorage.getItem('members_showAlive') !== 'false';
}
export function writeMembersShowAlive(v: boolean) {
  localStorage.setItem('members_showAlive', String(v));
}

export function readMembersShowCaptured(): boolean {
  return localStorage.getItem('members_showCaptured') !== 'false';
}
export function writeMembersShowCaptured(v: boolean) {
  localStorage.setItem('members_showCaptured', String(v));
}

export function readMembersShowDead(): boolean {
  return localStorage.getItem('members_showDead') !== 'false';
}
export function writeMembersShowDead(v: boolean) {
  localStorage.setItem('members_showDead', String(v));
}

export function readMembersHeroineOnly(): boolean {
  return localStorage.getItem('members_heroineOnly') === 'true';
}
export function writeMembersHeroineOnly(v: boolean) {
  localStorage.setItem('members_heroineOnly', String(v));
}
