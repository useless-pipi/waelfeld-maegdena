const fs = require('fs');
let src = fs.readFileSync('src/pages/RuleEngine.tsx', 'utf8');

// 1. Raise LYSSA_IDLE_THRESHOLD from 3 to 10
src = src.replace('const LYSSA_IDLE_THRESHOLD = 3;', 'const LYSSA_IDLE_THRESHOLD = 10;');

// 2. Replace the forced-fallback line (sort by threat only) with FSI-capped diff-first sort
const oldFallback = [
  '      // Nothing safe at all and idle threshold exceeded \u2014 force the single',
  '      // least-threatening mission to avoid an infinite refresh loop.',
  '      return pool.sort((a, b) => missionMaxThreat(a) - missionMaxThreat(b))[0];',
].join('\n');

const newFallback = [
  '      // Nothing passed the threat gate. Force the least-deadly option available.',
  '      // Sort: difficulty ASC (easy < normal < hard < extreme < hell) first \u2014 easy Lyssa',
  '      // at FSI deficit causes 1-3 KIA; normal causes 7-14; extreme causes 30-54.',
  '      // Cap difficulty by FSI so a small early-game roster never absorbs extreme KIA.',
  '      const maxForcedRank = fsi < 150 ? (DIFF_RANK[\'normal\'] ?? 1)',
  '                          : fsi < 260 ? (DIFF_RANK[\'hard\']   ?? 2)',
  '                          :             (DIFF_RANK[\'extreme\'] ?? 3);',
  '      const cappedForced = pool.filter(m => (DIFF_RANK[m.difficulty] ?? 0) <= maxForcedRank);',
  '      // Fall back to full pool only if the cap eliminates everything (avoids infinite loop).',
  '      const forcedPool = cappedForced.length > 0 ? cappedForced : pool;',
  '      return forcedPool.sort((a, b) => {',
  '        const dDiff = (DIFF_RANK[a.difficulty] ?? 0) - (DIFF_RANK[b.difficulty] ?? 0);',
  '        if (dDiff !== 0) return dDiff;',
  '        const stageDiff = (a.stages?.length ?? 1) - (b.stages?.length ?? 1);',
  '        if (stageDiff !== 0) return stageDiff;',
  '        return missionMaxThreat(a) - missionMaxThreat(b);',
  '      })[0];',
].join('\n');

const normalizedSrc = src.replace(/\r\n/g, '\n');
if (normalizedSrc.includes(oldFallback)) {
  src = normalizedSrc.replace(oldFallback, newFallback);
  fs.writeFileSync('src/pages/RuleEngine.tsx', src);
  console.log('Fallback replaced OK');
} else {
  // Try CRLF variant
  const oldFallbackCRLF = oldFallback.replace(/\n/g, '\r\n');
  if (src.includes(oldFallbackCRLF)) {
    src = src.replace(oldFallbackCRLF, newFallback);
    fs.writeFileSync('src/pages/RuleEngine.tsx', src);
    console.log('Fallback replaced OK (CRLF)');
  } else {
    console.log('Match failed. Searching for fragment...');
    const lines = src.split('\n');
    lines.forEach((l, i) => { if (l.includes('least-threatening')) console.log(i+1+':', JSON.stringify(l)); });
  }
}

const result = fs.readFileSync('src/pages/RuleEngine.tsx', 'utf8');
console.log('LYSSA_IDLE_THRESHOLD=10:', result.includes('const LYSSA_IDLE_THRESHOLD = 10;'));
console.log('maxForcedRank present:', result.includes('maxForcedRank'));
