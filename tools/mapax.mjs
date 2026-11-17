// mapa de |x| máximo por (altura, profundidade) e o material de cada célula (T tecido, M madeira)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [file, y0 = '0.2', y1 = '0.6', dy = '0.02', dz = '0.04'] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
const prims = doc.getRoot().listMeshes()[0].listPrimitives();
const pos = prims[0].getAttribute('POSITION').getArray();
const cell = new Map();
prims.forEach((p, k) => { const ix = p.getIndices().getArray(); const m = p.getMaterial().getName()[0];
  for (let t = 0; t < ix.length; t++) { const i = ix[t] * 3, x = pos[i], y = pos[i + 1], z = pos[i + 2]; if (x < 0) continue;
    const key = Math.floor(y / +dy) + ',' + Math.round(z / +dz); const c = cell.get(key); if (!c || x > c[0]) cell.set(key, [x, m]); } });
const zs = []; for (let z = -0.44; z <= 0.44; z += +dz) zs.push(Math.round(z / +dz));
console.log('y\\z   ' + zs.map((z) => (z * +dz).toFixed(2).padStart(7)).join(''));
for (let yi = Math.floor(+y1 / +dy); yi >= Math.floor(+y0 / +dy); yi--) console.log((yi * +dy).toFixed(2) + '  ' + zs.map((z) => { const c = cell.get(yi + ',' + z); return c ? (c[0].toFixed(3) + c[1]).padStart(7) : '      .'; }).join(''));
