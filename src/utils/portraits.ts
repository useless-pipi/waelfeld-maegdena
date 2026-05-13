/**
 * Image system for maidens and enemies.
 *
 * All images are served from the public/ directory (Vite dev + production).
 *
 * Maiden images → /imgs/chars/
 *   imgId   0 – 899  : heroine       (3-digit padded, e.g. 005 → 005.png / 005i.png)
 *   imgId 900 – 999  : zako maiden   (3-digit padded, e.g. 901 → 901.png / 901i.png)
 *
 * Enemy images → /imgs/enemy/
 *   imgId 1000 – 1899 : Lyssa       (e.g. 1001 → 1001.png / 1001i.png)
 *   imgId 1900 – 1999 : zako enemy  (e.g. 1901 → 1901.png / 1901i.png)
 *
 * The imgId range alone determines the correct folder.
 */

// ── Available image ID ranges (based on files present in public/imgs/) ────────
/** All valid zako maiden imgIds (901–906) */
export const ZAKO_MAIDEN_IMG_IDS: number[] = [901, 902, 903, 904, 905, 906];

/** All valid heroine imgIds (000–060) */
export const HEROINE_IMG_IDS: number[] = Array.from({ length: 61 }, (_, i) => i);

/** All valid Lyssa imgIds (1001–1030) */
export const LYSSA_IMG_IDS: number[] = Array.from({ length: 30 }, (_, i) => i + 1001);

/** All valid zako enemy imgIds (1901–1905) */
export const ZAKO_ENEMY_IMG_IDS: number[] = [1901, 1902, 1903, 1904, 1905];

// ── Random helpers ────────────────────────────────────────────────────────────
export function randomZakoMaidenImgId(): number {
  return ZAKO_MAIDEN_IMG_IDS[Math.floor(Math.random() * ZAKO_MAIDEN_IMG_IDS.length)];
}

export function randomZakoEnemyImgId(): number {
  return ZAKO_ENEMY_IMG_IDS[Math.floor(Math.random() * ZAKO_ENEMY_IMG_IDS.length)];
}

// ── URL builders ──────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

function charPath(imgId: number, icon: boolean): string {
  const s = String(imgId).padStart(3, '0');
  return `${BASE}/imgs/chars/${s}${icon ? 'i' : ''}.png`;
}

function enemyPath(imgId: number, icon: boolean): string {
  return `${BASE}/imgs/enemy/${imgId}${icon ? 'i' : ''}.png`;
}

/**
 * Square icon URL for a unit identified by imgId.
 * imgId < 1000 → chars folder; imgId >= 1000 → enemy folder.
 */
export function getUnitIcon(imgId: number): string {
  return imgId < 1000 ? charPath(imgId, true) : enemyPath(imgId, true);
}

/**
 * Full-body portrait URL for a unit identified by imgId.
 * imgId < 1000 → chars folder; imgId >= 1000 → enemy folder.
 */
export function getUnitPortrait(imgId: number): string {
  return imgId < 1000 ? charPath(imgId, false) : enemyPath(imgId, false);
}

/** Square icon URL specifically for a maiden (chars folder). */
export function getMaidenIcon(imgId: number): string {
  return charPath(imgId, true);
}

/** Full-body portrait URL specifically for a maiden (chars folder). */
export function getMaidenPortrait(imgId: number): string {
  return charPath(imgId, false);
}

/** Square icon URL specifically for an enemy (enemy folder). */
export function getEnemyIcon(imgId: number): string {
  return enemyPath(imgId, true);
}

/** Full-body portrait URL specifically for an enemy (enemy folder). */
export function getEnemyPortrait(imgId: number): string {
  return enemyPath(imgId, false);
}
