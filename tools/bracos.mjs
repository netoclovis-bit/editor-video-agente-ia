// altura do topo do braço (y máximo dos vértices na faixa de 3 cm da lateral) e faixa de z
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
for (const f of process.argv.slice(2)) {
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f);
  const pos = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray();
  let mx = 0; for (let i = 0; i < pos.length; i += 3) mx = Math.max(mx, Math.abs(pos[i]));
  let yT = 0, z0 = 9, z1 = -9;
  for (let i = 0; i < pos.length; i += 3) if (Math.abs(pos[i]) > mx - 0.03) { yT = Math.max(yT, pos[i + 1]); z0 = Math.min(z0, pos[i + 2]); z1 = Math.max(z1, pos[i + 2]); }
  console.log(f.split('/').pop(), 'meia largura', mx.toFixed(3), '| topo do braço (lateral)', yT.toFixed(3), '| z', z0.toFixed(2), z1.toFixed(2));
}
