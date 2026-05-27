const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/_rule_engine_log/rule_engine_1778996436783.json'));
const m = data.missions;
console.log('=== META ===');
console.log('Total KIA:', data.meta.totalKia, '/ 2000 missions');
console.log('Final FSI:', data.meta.finalFsi, data.meta.finalTier, 'roster:', data.meta.finalRoster);

// KIA sources
const ly = m.filter(x=>x.hasLyssa), nl = m.filter(x=>!x.hasLyssa);
const waves = m.filter(x=>x.focus==='lyssa_wave');
const nonWaveLy = m.filter(x=>x.hasLyssa && x.focus!=='lyssa_wave');
console.log('\n=== KIA SOURCES ===');
console.log('Lyssa Wave KIA:', waves.reduce((s,x)=>s+x.kia,0), '/', waves.length, 'waves, avg:', (waves.reduce((s,x)=>s+x.kia,0)/waves.length).toFixed(1));
console.log('Non-wave Lyssa KIA:', nonWaveLy.reduce((s,x)=>s+x.kia,0), '/', nonWaveLy.length, 'missions');
console.log('Non-Lyssa KIA:', nl.reduce((s,x)=>s+x.kia,0), '/', nl.length, 'missions');

// Outcomes
const wipes=m.filter(x=>x.out==='wipe'), retreats=m.filter(x=>x.out==='retreat'), wins=m.filter(x=>x.out==='win');
console.log('\n=== OUTCOMES ===');
console.log('Wins:', wins.length, 'KIA:', wins.reduce((s,x)=>s+x.kia,0));
console.log('Retreats:', retreats.length, 'KIA:', retreats.reduce((s,x)=>s+x.kia,0));
console.log('Wipes:', wipes.length, 'KIA:', wipes.reduce((s,x)=>s+x.kia,0));

// Wave detail
console.log('\n=== WAVE DETAIL ===');
waves.forEach(x=>console.log('  msn'+x.msn+' kia='+x.kia+' '+x.out+' threat='+x.threat+' deploy='+x.deployFsi+' roster='+x.roster));

// Top KIA missions
console.log('\n=== TOP 20 KIA MISSIONS ===');
[...m].sort((a,b)=>b.kia-a.kia).slice(0,20).forEach(x=>{
  console.log('msn'+x.msn+' kia='+x.kia+' '+x.out+' '+x.diff+' '+x.focus+' stages='+x.stages+' threat='+x.threat+' deploy='+x.deployFsi+' ratio='+(x.deployFsi/Math.max(1,x.threat)).toFixed(1)+' ly='+x.hasLyssa);
});

// FSI progression every 100 missions
console.log('\n=== FSI PROGRESSION (every 100 msn) ===');
for (let i=100; i<=2000; i+=100) {
  const entry = m.find(x=>x.msn>=i);
  if (entry) console.log('msn'+i+' fsi:'+entry.baseFsi+' tier:'+entry.tier+' roster:'+entry.roster);
}

// KIA per 100-mission band
console.log('\n=== KIA PER 100-MISSION BAND ===');
for (let i=1; i<=2000; i+=100) {
  const band = m.filter(x=>x.msn>=i&&x.msn<i+100);
  const kia = band.reduce((s,x)=>s+x.kia,0);
  const waveKia = band.filter(x=>x.focus==='lyssa_wave').reduce((s,x)=>s+x.kia,0);
  const fsi = band.length>0?band[0].baseFsi:0;
  console.log('msn '+i+'-'+(i+99)+': KIA='+kia+' (wave='+waveKia+') fsi='+fsi+' n='+band.length);
}

// Tier distribution
console.log('\n=== TIER DISTRIBUTION ===');
const tiers={};
m.forEach(x=>{ tiers[x.tier]=(tiers[x.tier]||0)+1; });
console.log(tiers);

// When does FSI cross key thresholds
console.log('\n=== FSI THRESHOLD CROSSINGS ===');
[100,150,200,250,300,400].forEach(thresh=>{
  const first=m.find(x=>x.baseFsi>=thresh);
  if(first) console.log('FSI>='+thresh+': first at msn'+first.msn+' (tier:'+first.tier+')');
  else console.log('FSI>='+thresh+': never reached');
});

// Difficulty distribution
console.log('\n=== DIFFICULTY DISTRIBUTION ===');
['easy','normal','hard','extreme'].forEach(d=>{
  const ms=m.filter(x=>x.diff===d);
  if(ms.length) console.log(d,'count:',ms.length,'KIA:',ms.reduce((s,x)=>s+x.kia,0),'avg:',(ms.reduce((s,x)=>s+x.kia,0)/ms.length).toFixed(2));
});

// When do hard/extreme missions start being picked
const hardPlus = m.filter(x=>x.diff==='hard'||x.diff==='extreme');
if(hardPlus.length) {
  console.log('\n=== HARD/EXTREME MISSIONS ===');
  hardPlus.slice(0,10).forEach(x=>console.log('msn'+x.msn+' '+x.diff+' kia='+x.kia+' fsi='+x.baseFsi+' deploy='+x.deployFsi+' threat='+x.threat));
}

// Non-lyssa retreats
const nlRetreats = m.filter(x=>!x.hasLyssa && x.out==='retreat');
console.log('\n=== NON-LYSSA RETREATS ===');
console.log('count:', nlRetreats.length, 'KIA:', nlRetreats.reduce((s,x)=>s+x.kia,0));
nlRetreats.slice(0,10).forEach(x=>console.log('msn'+x.msn+' kia='+x.kia+' '+x.diff+' '+x.focus+' stages='+x.stages+' threat='+x.threat+' deploy='+x.deployFsi));
