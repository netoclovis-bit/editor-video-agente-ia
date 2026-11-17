const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}); const pg=await b.newPage({viewport:{width:900,height:600}});
pg.on('console',m=>{ if(m.type()==='error') console.log('console:',m.text())});
const shots=JSON.parse(process.argv[2]);
for(const [q,out] of shots){ await pg.goto('http://localhost:8765/view.html?'+q); await pg.waitForFunction(()=>window.__ready,{timeout:60000}); await pg.screenshot({path:out}); console.log('ok',out);} await b.close(); })();
