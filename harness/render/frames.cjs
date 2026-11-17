const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}); const pg=await b.newPage({viewport:{width:900,height:600}});
for (const [src,orbit,color,tag] of [['rec/doha-085-rec.glb','-55deg 76deg 3.0m','[[0.12,0.075,0.05],[0.05,0.03,0.02],0.6,0.8]','doha'],['rec/dalian-098-rec.glb','-55deg 76deg 3.2m','[[0.33,0.29,0.22],[0,0,0],0.5,0.45]','dalian']]) {
  await pg.goto(`http://localhost:8765/view.html?src=${src}&orbit=${encodeURIComponent(orbit)}&color=${encodeURIComponent(color)}&t=0`); await pg.waitForFunction(()=>window.__ready,{timeout:60000});
  const N=24; for (let i=0;i<=N;i++){ const t=1.2*(i/N); await pg.evaluate((t)=>{ const mv=document.getElementById('mv'); mv.currentTime=t; }, t); await pg.waitForTimeout(250); await pg.screenshot({path:`rec/f-${tag}-${String(i).padStart(2,'0')}.png`}); }
  console.log('ok', tag);
}
await b.close(); })();
