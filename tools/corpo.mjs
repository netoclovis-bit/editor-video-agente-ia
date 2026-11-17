// Altura onde começa o corpo estofado (y mínimo no miolo, longe dos pés) e altura até onde vão os pés
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
for (const f of process.argv.slice(2)) {
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f);
  const prims = doc.getRoot().listMeshes()[0].listPrimitives();
  const pos = prims[0].getAttribute('POSITION').getArray();
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[i + a]); mx[a] = Math.max(mx[a], pos[i + a]); }
  let yb = 1e9;
  for (let i = 0; i < pos.length; i += 3) if (Math.abs(pos[i]) < mx[0] * 0.35 && Math.abs(pos[i + 2]) < mx[2] * 0.35) yb = Math.min(yb, pos[i + 1]);
  // por material: maior y de madeira
  const out = prims.map((p) => { const ix = p.getIndices().getArray(); let ym = 0; for (let t = 0; t < ix.length; t++) ym = Math.max(ym, pos[ix[t] * 3 + 1]); return p.getMaterial().getName() + ' até ' + ym.toFixed(3); });
  console.log(f.split('/').pop(), '| corpo começa em y =', yb.toFixed(3), '|', out.join(' | '));
}
