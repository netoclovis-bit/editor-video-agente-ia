import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [file, xs='0', mode='front'] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
const prims = doc.getRoot().listMeshes()[0].listPrimitives();
const pos = prims[0].getAttribute('POSITION').getArray();
for (const xc of xs.split(',').map(Number)) {
const bins = new Map();
for (const pr of prims) { const idx = pr.getIndices().getArray();
  for (let t=0;t<idx.length;t+=3){ const v=[idx[t],idx[t+1],idx[t+2]].map(i=>[pos[i*3],pos[i*3+1],pos[i*3+2]]);
    const pts=[]; for (let e=0;e<3;e++){ const a=v[e], b=v[(e+1)%3]; if ((a[0]-xc)*(b[0]-xc)<0){ const s=(xc-a[0])/(b[0]-a[0]); pts.push([a[1]+s*(b[1]-a[1]), a[2]+s*(b[2]-a[2])]); } }
    for (const [y,z] of pts) { const k=Math.round(y/0.01); const cur=bins.get(k); if (mode==='front' ? (cur===undefined||z>cur) : (cur===undefined||z<cur)) bins.set(k,z); } } }
console.log('x='+xc, mode, [...bins.entries()].sort((a,b)=>a[0]-b[0]).filter(([k])=>k%1===0 && k<=60).map(([k,z])=>(k/100).toFixed(2)+':'+z.toFixed(3)).join('  '));
}
