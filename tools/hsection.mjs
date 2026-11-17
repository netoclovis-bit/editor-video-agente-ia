// corte horizontal no plano y = yc: x nas colunas (esq->dir), z nas linhas (trás em cima, frente embaixo)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [file, ...ys] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
const prims = doc.getRoot().listMeshes()[0].listPrimitives();
const pos = prims[0].getAttribute('POSITION').getArray();
let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
for (let i=0;i<pos.length;i+=3) for (let a=0;a<3;a++){mn[a]=Math.min(mn[a],pos[i+a]);mx[a]=Math.max(mx[a],pos[i+a]);}
const cell=0.02;
for (const yc of ys.map(Number)) {
  const nx=Math.ceil((mx[0]-mn[0])/cell)+1, nz=Math.ceil((mx[2]-mn[2])/cell)+1;
  const g=Array.from({length:nz},()=>Array(nx).fill('.'));
  for (const pr of prims) { const idx=pr.getIndices().getArray();
  for (let t=0;t<idx.length;t+=3){ const v=[idx[t],idx[t+1],idx[t+2]].map(i=>[pos[i*3],pos[i*3+1],pos[i*3+2]]);
    const pts=[]; for (let e=0;e<3;e++){ const a=v[e], b=v[(e+1)%3]; if ((a[1]-yc)*(b[1]-yc)<0){ const s=(yc-a[1])/(b[1]-a[1]); pts.push([a[0]+s*(b[0]-a[0]), a[2]+s*(b[2]-a[2])]); } }
    if (pts.length===2) for (let s=0;s<=1;s+=0.25){ const x=pts[0][0]+s*(pts[1][0]-pts[0][0]), z=pts[0][1]+s*(pts[1][1]-pts[0][1]); g[Math.round((z-mn[2])/cell)][Math.round((x-mn[0])/cell)]='#'; } } }
  console.log(`\n y=${yc}  (colunas x ${mn[0].toFixed(2)}..${mx[0].toFixed(2)}; linhas z de trás ${mn[2].toFixed(2)} p/ frente ${mx[2].toFixed(2)})`);
  for (let z=0;z<nz;z++) console.log((mn[2]+z*cell).toFixed(2).padStart(6)+' |'+g[z].join(''));
}
