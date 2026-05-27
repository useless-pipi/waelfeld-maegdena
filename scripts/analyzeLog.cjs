const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:/Users/User/Documents/GitHub/waelfeld-maegdena/src/_rule_engine_log/rule_engine_1778994858827.json'));
const m = data.missions;

console.log('=== META ===');
console.log('Total KIA:', data.meta.totalKia);
console.log('Total missions:', data.meta.totalMissions);
console.log('Total ticks:', data.meta.totalTicks);
console.log('Final FSI:', data.meta.finalFsi, data.meta.finalTier);
console.log('Final roster:', data.meta.finalRoster);

const wipes = m.filter(x=>x.out==='wipe');
const retreats = m.filter(x=>x.out==='retreat');
const wins = m.filter(x=>x.out==='win');
console.log('\n=== OUTCOMES ===');
console.log('Wins:', wins.length, 'KIA:', wins.reduce((s,x)=>s+x.kia,0));
console.log('Retreats:', retreats.length, 'KIA:', retreats.reduce((s,x)=>s+x.kia,0));
console.log('Wipes:', wipes.length, 'KIA:', wipes.reduce((s,x)=>s+x.kia,0));

const lyssa = m.filter(x=>x.hasLyssa);
const noLyssa = m.filter(x=>!x.hasLyssa);
console.log('\n=== LYSSA ===');
console.log('Lyssa missions:', lyssa.length, 'KIA:', lyssa.reduce((s,x)=>s+x.kia,0), 'avg KIA:', (lyssa.reduce((s,x)=>s+x.kia,0)/lyssa.length).toFixed(2));
console.log('Non-lyssa:', noLyssa.length, 'KIA:', noLyssa.reduce((s,x)=>s+x.kia,0), 'avg KIA:', (noLyssa.reduce((s,x)=>s+x.kia,0)/noLyssa.length).toFixed(2));

// Lyssa KIA breakdown by outcome
const lyssaWipes = lyssa.filter(x=>x.out==='wipe');
const lyssaRetreats = lyssa.filter(x=>x.out==='retreat');
const lyssaWins = lyssa.filter(x=>x.out==='win');
console.log('  Lyssa wins:', lyssaWins.length, 'KIA:', lyssaWins.reduce((s,x)=>s+x.kia,0));
console.log('  Lyssa retreats:', lyssaRetreats.length, 'KIA:', lyssaRetreats.reduce((s,x)=>s+x.kia,0));
console.log('  Lyssa wipes:', lyssaWipes.length, 'KIA:', lyssaWipes.reduce((s,x)=>s+x.kia,0));

console.log('\n=== TOP 20 KIA MISSIONS ===');
[...m].sort((a,b)=>b.kia-a.kia).slice(0,20).forEach(x=>{
  console.log('msn'+x.msn+' kia='+x.kia+' '+x.out+' '+x.diff+' '+x.focus+' stages='+x.stages+' threat='+x.threat+' deployFsi='+x.deployFsi+' lyssa='+x.hasLyssa+' tier='+x.tier);
});

console.log('\n=== KIA BY DIFFICULTY ===');
['easy','normal','hard','extreme'].forEach(d=>{
  const ms = m.filter(x=>x.diff===d);
  if (ms.length) console.log(d, 'count:', ms.length, 'KIA:', ms.reduce((s,x)=>s+x.kia,0), 'avg:', (ms.reduce((s,x)=>s+x.kia,0)/ms.length).toFixed(2));
});

console.log('\n=== FSI PROGRESSION (snapshot near each 50 missions) ===');
for (let i=50; i<=400; i+=50) {
  const entry = m.find(x=>x.msn>=i);
  if (entry) console.log('msn', i, 'fsi:', entry.baseFsi, 'tier:', entry.tier, 'roster:', entry.roster);
}

const first100 = m.filter(x=>x.msn<=100);
const last100 = m.filter(x=>x.msn>300);
console.log('\n=== EARLY vs LATE ===');
console.log('First 100 KIA:', first100.reduce((s,x)=>s+x.kia,0));
console.log('Last 100 KIA:', last100.reduce((s,x)=>s+x.kia,0));

console.log('\n=== TIER DISTRIBUTION ===');
const tiers = {};
m.forEach(x=>{ tiers[x.tier]=(tiers[x.tier]||0)+1; });
console.log(tiers);

console.log('\n=== FOCUS DISTRIBUTION ===');
const foc = {};
m.forEach(x=>{ foc[x.focus]=(foc[x.focus]||0)+1; });
console.log(foc);

// Lyssa wins that still caused KIA - check FSI ratios
console.log('\n=== LYSSA WINS WITH KIA > 0 (threat ratio analysis) ===');
lyssa.filter(x=>x.out==='win'&&x.kia>0).sort((a,b)=>b.kia-a.kia).slice(0,15).forEach(x=>{
  const ratio = x.threat>0 ? (x.deployFsi/x.threat).toFixed(1) : 'n/a';
  console.log('msn'+x.msn+' kia='+x.kia+' '+x.diff+' threat='+x.threat+' deployFsi='+x.deployFsi+' ratio='+ratio+' stages='+x.stages);
});

// Non-lyssa KIA sources
console.log('\n=== NON-LYSSA MISSIONS WITH KIA > 2 ===');
noLyssa.filter(x=>x.kia>2).sort((a,b)=>b.kia-a.kia).slice(0,15).forEach(x=>{
  const ratio = x.threat>0 ? (x.deployFsi/x.threat).toFixed(1) : 'n/a';
  console.log('msn'+x.msn+' kia='+x.kia+' '+x.out+' '+x.diff+' '+x.focus+' threat='+x.threat+' deployFsi='+x.deployFsi+' ratio='+ratio+' stages='+x.stages);
});

// KIA per 25-mission band
console.log('\n=== KIA PER 25-MISSION BAND ===');
for (let i=1; i<=400; i+=25) {
  const band = m.filter(x=>x.msn>=i&&x.msn<i+25);
  const kia = band.reduce((s,x)=>s+x.kia,0);
  const fsi = band.length>0 ? band[0].baseFsi : 0;
  console.log('msn '+i+'-'+(i+24)+': KIA='+kia+' missions='+band.length+' startFsi='+fsi);
}
