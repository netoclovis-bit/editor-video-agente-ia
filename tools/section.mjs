// Perfis da poltrona: corte no plano x = xc (triângulos que cruzam o plano), desenhado em ASCII (y para cima, z da esquerda=trás p/ direita=frente)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [file, ...xs] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
const prims = doc.getRoot().listMeshes()[0].listPrimitives();
const pos = prims[0].getAttribute('POSITION').getArray();
let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
for (let i=0;i<pos.length;i+=3) for (let a=0;a<3;a++){mn[a]=Math.min(mn[a],pos[i+a]);mx[a]=Math.max(mx[a],pos[i+a]);}
console.log('bbox', mn.map(v=>v.toFixed(3)), mx.map(v=>v.toFixed(3)), 'prims', prims.map(p=>p.getMaterial()?.getName()+':'+p.getIndices().getCount()/3));
const cell=0.02;
for (const xc of xs.map(Number)) {
  const ny=Math.ceil((mx[1]-mn[1])/cell)+1, nz=Math.ceil((mx[2]-mn[2])/cell)+1;
  const g=Array.from({length:ny},()=>Array(nz).fill('.'));
  prims.forEach((pr,k)=>{ const idx=pr.getIndices().getArray(); const ch=k===0?'#':'P';
  for (let t=0;t<idx.length;t+=3){ const v=[idx[t],idx[t+1],idx[t+2]].map(i=>[pos[i*3],pos[i*3+1],pos[i*3+2]]);
    const pts=[]; for (let e=0;e<3;e++){ const a=v[e], b=v[(e+1)%3]; if ((a[0]-xc)*(b[0]-xc)<0){ const s=(xc-a[0])/(b[0]-a[0]); pts.push([a[1]+s*(b[1]-a[1]), a[2]+s*(b[2]-a[2])]); } }
    if (pts.length===2) for (let s=0;s<=1;s+=0.25){ const y=pts[0][0]+s*(pts[1][0]-pts[0][0]), z=pts[0][1]+s*(pts[1][1]-pts[0][1]); g[Math.round((y-mn[1])/cell)][Math.round((z-mn[2])/cell)]=ch; } } });
  console.log(`\n x=${xc}  (esq=trás z=${mn[2].toFixed(2)}  dir=frente z=${mx[2].toFixed(2)}, ${cell} m por char)`);
  for (let y=ny-1;y>=0;y-=1) console.log((mn[1]+y*cell).toFixed(2).padStart(5)+' |'+g[y].join(''));
}
