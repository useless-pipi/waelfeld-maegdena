import namesData from '../data/names.json';

/**
 * Box-Muller transform: returns a normally distributed value.
 */
function gaussianRandom(mean: number, sd: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.round(mean + sd * n);
}

/** Returns a stat value clamped to [1, 20] from normal distribution μ=7, σ=3 */
export function randomStat(): number {
  return Math.min(20, Math.max(1, gaussianRandom(7, 3)));
}

/** Returns a full medieval-style name "Firstname Surname" */
export function generateName(): string {
  const firstNames = namesData.female;
  const surnames = namesData.surnames;
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = surnames[Math.floor(Math.random() * surnames.length)];
  return `${first} ${last}`;
}
