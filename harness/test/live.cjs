const { chromium } = require('playwright');
const fs = require('fs');
const MV = fs.readFileSync(__dirname + '/model-viewer.min.js');
(async()=>{ const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for (const [path,tag,scheme] of [['','escolha','light'],['sofa-outlet','sofa','light'],['decorart#lazio','deco','dark']]) {
   const pg=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:scheme});
   pg.on('pageerror',e=>console.log('pageerror',e.message));
   await pg.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ body: MV, contentType: 'text/javascript' }));
   await pg.goto('https://projeto-3d.pages.dev/' + path, { waitUntil: 'domcontentloaded' });
   if (tag !== 'escolha') {
     await pg.waitForFunction(()=>document.getElementById('loading') && document.getElementById('loading').hidden,{timeout:120000});
     await pg.waitForTimeout(2500);
     console.log(tag, await pg.evaluate(()=>[document.getElementById('nome').textContent, document.getElementById('mv').src.split('/').pop(), document.getElementById('ctaTop').href.slice(0,40)].join(' | ')));
   } else {
     await pg.waitForTimeout(1500);
     console.log(tag, await pg.evaluate(()=>[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')+' → '+a.textContent.trim().replace(/\s+/g,' ').slice(0,40)).join(' || ')));
   }
   await pg.screenshot({path:`live-${tag}.png`}); await pg.close();
 }
 await b.close(); })();
