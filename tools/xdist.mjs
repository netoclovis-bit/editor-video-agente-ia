import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
for (const m of doc.getRoot().listMeshes()) {
  const pos = m.listPrimitives()[0].getAttribute('POSITION').getArray();
  const bins = new Map();
  for (let i=0;i<pos.length;i+=3){ const b=Math.round(pos[i]*20)/20; const y=pos[i+1]; const e=bins.get(b)||{n:0,ymax:-9,ymin:9,zmin:9,zmax:-9}; e.n++; e.ymax=Math.max(e.ymax,y); e.ymin=Math.min(e.ymin,y); e.zmin=Math.min(e.zmin,pos[i+2]); e.zmax=Math.max(e.zmax,pos[i+2]); bins.set(b,e);}
  console.log('==', m.getName());
  for (const [k,v] of [...bins].sort((a,b)=>a[0]-b[0])) console.log(k.toFixed(2).padStart(6), String(v.n).padStart(4), 'y', v.ymin.toFixed(2), v.ymax.toFixed(2), 'z', v.zmin.toFixed(2), v.zmax.toFixed(2));
}
