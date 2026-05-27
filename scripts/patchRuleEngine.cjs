const fs = require('fs');
let src = fs.readFileSync('src/pages/RuleEngine.tsx', 'utf8');

// 1. Simplify safeForced block — remove LYSSA_FORCE_MAX_DIFF cap
src = src.replace(
  /      \/\/ Even when forced[\s\S]*?return null;\r?\n    \}/,
  [
    '      // When forced (idleStreak >= LYSSA_IDLE_THRESHOLD), pick the best safe option.',
    '      // lyssaTooRisky gates hard/extreme Lyssa via threatOk (mult=1.5 requires',
    '      // FSI>=210 for hard, FSI>=488 for extreme) -- no separate diff cap needed.',
    '      const safeForced = pool.filter(m => !lyssaTooRisky(m));',
    '      if (safeForced.length > 0) {',
    '        return safeForced.sort((a, b) => {',
    '          const stageDiff = (a.stages?.length ?? 1) - (b.stages?.length ?? 1);',
    '          if (stageDiff !== 0) return stageDiff;',
    '          return missionMaxThreat(a) - missionMaxThreat(b);',
    '        })[0];',
    '      }',
    '      // Nothing safe at all -- keep refreshing regardless of idleStreak.',
    '      return null;',
    '    }',
  ].join('\r\n')
);

// 2. focusScore Lyssa penalty: 0.4 -> 0.8
src = src.replace(
  /    \/\/ Devalue Lyssa-bearing missions[\s\S]*?return missionHasLyssa\(m\) \? Math\.round\(score \* 0\.4\) : score;/,
  [
    '    // Slight devalue for Lyssa so equally-scored non-Lyssa wins ties, but',
    "    // don't actively suppress Lyssa that has passed the threat gate.",
    '    return missionHasLyssa(m) ? Math.round(score * 0.8) : score;',
  ].join('\r\n')
);

fs.writeFileSync('src/pages/RuleEngine.tsx', src);
console.log('Done.');
console.log('safeForced occurrences:', (src.match(/safeForced/g)||[]).length);
console.log('0.4 penalty remaining:', (src.match(/score \* 0\.4/g)||[]).length);
console.log('0.8 penalty:', (src.match(/score \* 0\.8/g)||[]).length);
console.log('LYSSA_FORCE_MAX_DIFF remaining:', (src.match(/LYSSA_FORCE_MAX_DIFF/g)||[]).length);
