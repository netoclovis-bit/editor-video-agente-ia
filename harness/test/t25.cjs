const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const shots=[];
 for (const [page,id,tag] of [['index.html','versalhes','sofa'],['decorar.html','versalhes','deco'],['index.html','valencia','val']]) {
   const pg=await b.newPage({viewport:{width:980,height:760},deviceScaleFactor:1}); pg.on('pageerror',e=>console.log('pageerror',e.message)); pg.on('console',m=>{ if(m.type()==='error') console.log('console',m.text()); });
   await pg.goto(`http://localhost:8766/${page}#${id}`); await pg.waitForFunction(()=>document.getElementById('loading').hidden,{timeout:90000}); await pg.waitForTimeout(2000);
   await pg.evaluate(()=>document.getElementById('tgOpen').click()); await pg.waitForTimeout(6000);
   console.log(tag, await pg.evaluate(()=>[document.getElementById('origem').textContent, document.getElementById('tgOpenLabel').textContent, document.getElementById('mv').src.split('/').pop(), document.getElementById('mv').currentTime.toFixed(2), document.getElementById('tapeD').textContent].join(' | ')));
   await pg.screenshot({path:`ret-${tag}.png`, clip:{x:0,y:60,width:560,height:520}}); await pg.close();
 }
 await b.close(); })();
