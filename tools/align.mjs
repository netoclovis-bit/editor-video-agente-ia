import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const pts=[];
for (const m of doc.getRoot().listMeshes()) { const a=m.listPrimitives()[0].getAttribute('POSITION').getArray(); for(let i=0;i<a.length;i+=3) pts.push([a[i],a[i+1],a[i+2]]); }
let best=null;
for(let t=0;t<180;t+=0.05){ const r=t*Math.PI/180,c=Math.cos(r),s=Math.sin(r); let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; for(const p of pts){const x=c*p[0]-s*p[2], z=s*p[0]+c*p[2]; if(x<x0)x0=x; if(x>x1)x1=x; if(z<z0)z0=z; if(z>z1)z1=z;} const area=(x1-x0)*(z1-z0); if(!best||area<best.area) best={t,area,w:x1-x0,d:z1-z0}; }
console.log(best);
