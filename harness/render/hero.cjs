const { chromium } = require('playwright'); const fs=require('fs');
const C=JSON.parse(fs.readFileSync(__dirname+'/hero-colors.json','utf8'));
(async()=>{ const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const out=__dirname+'/saida/'; require('fs').mkdirSync(out,{recursive:true});
 for (const [src,orbit,col,t,name,w,h] of [
   ['hero-versalhes.glb','-34deg 78deg 5.2m','terracota',null,'hero-versalhes.png',1400,940],
   ['hero-versalhes-aberto.glb','-40deg 68deg 5.8m','terracota',1.2,'versalhes-aberto.png',1200,900],
   ['hero-doha.glb','-52deg 74deg 4.3m','chocolate',1.2,'doha-reclinada.png',1000,900]]) {
   const pg=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1.5});
   const q=new URLSearchParams({src,orbit,color:JSON.stringify(C[col])}); if(t!=null) q.set('t',t);
   await pg.goto('http://localhost:8765/hero.html?'+q.toString()); await pg.waitForFunction(()=>window.__ready,{timeout:90000});
   await pg.screenshot({path:out+name, omitBackground:true}); console.log('ok',name); await pg.close();
 }
 await b.close(); })();
