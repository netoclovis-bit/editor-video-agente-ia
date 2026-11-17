const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const info = () => [document.getElementById('nome').textContent, document.getElementById('sizeName').textContent, 'botão:'+(document.getElementById('tgOpen').hidden?'oculto':document.getElementById('tgOpenLabel').textContent), 'D:'+document.getElementById('tapeD').textContent, 'H:'+document.getElementById('tapeH').textContent, 'spec:'+document.getElementById('sD').textContent, document.getElementById('fitNote').textContent.slice(0,80)].join(' | ');
 for (const [vp,tag] of [[{width:1280,height:1000},'desk'],[{width:390,height:844,isMobile:true,hasTouch:true},'mob']]) {
 const {width,height,...rest}=vp; const pg=await b.newPage({viewport:{width,height},deviceScaleFactor:1,...rest}); pg.on('pageerror',e=>console.log('pageerror',e.message)); pg.on('console',m=>{ if(m.type()==='error') console.log('console',m.text()); });
 await pg.goto('http://localhost:8766/decorar.html#doha'); await pg.waitForFunction(()=>document.getElementById('loading').hidden,{timeout:90000}); await pg.waitForTimeout(2500);
 console.log(tag, 'fechada:', await pg.evaluate(info), 'anims:', await pg.evaluate(()=>document.getElementById('mv').availableAnimations.join(',')));
 await pg.evaluate(()=>document.getElementById('tgOpen').click()); await pg.waitForTimeout(3500);
 console.log(tag, 'aberta :', await pg.evaluate(info), 't=', await pg.evaluate(()=>document.getElementById('mv').currentTime.toFixed(2)));
 await pg.screenshot({path:`deco-rec-doha-${tag}.png`, clip: tag==='mob'?{x:0,y:0,width:390,height:520}:undefined});
 // troca para Dalian elétrica aberta
 await pg.evaluate(()=>{ [...document.querySelectorAll('input[name=model]')].find(x=>x.parentElement.querySelector('b').textContent==='Dalian').click(); }); await pg.waitForTimeout(3500);
 console.log(tag, 'dalian :', await pg.evaluate(info));
 await pg.evaluate(()=>document.getElementById('tgOpen').click()); await pg.waitForTimeout(3500);
 await pg.evaluate(()=>document.querySelector('input[name=size][value="1"]').click()); await pg.waitForTimeout(4000);
 console.log(tag, 'dalian elétrica aberta:', await pg.evaluate(info), 't=', await pg.evaluate(()=>document.getElementById('mv').currentTime.toFixed(2)));
 await pg.screenshot({path:`deco-rec-dalian-${tag}.png`, clip: tag==='mob'?{x:0,y:0,width:390,height:520}:undefined});
 await pg.evaluate(()=>document.getElementById('tgOpen').click()); await pg.waitForTimeout(3000);
 console.log(tag, 'dalian fechada de novo:', await pg.evaluate(info), 't=', await pg.evaluate(()=>document.getElementById('mv').currentTime.toFixed(2)));
 // sofá retrátil continua funcionando
 await pg.evaluate(()=>{ [...document.querySelectorAll('input[name=model]')].find(x=>x.parentElement.querySelector('b').textContent==='Valência').click(); }); await pg.waitForTimeout(3000);
 console.log(tag, 'valência:', await pg.evaluate(info));
 await pg.close(); }
 await b.close(); })();
