// Conta arestas de borda (buracos) no tecido de cada .glb, com a posição média delas
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsSheen, KHRMaterialsSpecular } from '@gltf-transform/extensions';
for (const f of process.argv.slice(2)) {
  const doc = await new NodeIO().registerExtensions([KHRMaterialsSheen, KHRMaterialsSpecular]).read(f);
  const prims = doc.getRoot().listMeshes()[0].listPrimitives();
  const pos = prims[0].getAttribute('POSITION').getArray();
  // usa todas as primitivas (compartilham os vértices) e solda por posição
  const keyOf = new Map(), id = new Int32Array(pos.length / 3);
  for (let i = 0; i < pos.length / 3; i++) { const k = `${Math.round(pos[i*3]*1e4)},${Math.round(pos[i*3+1]*1e4)},${Math.round(pos[i*3+2]*1e4)}`; if (!keyOf.has(k)) keyOf.set(k, keyOf.size); id[i] = keyOf.get(k); }
  const cnt = new Map();
  for (const p of prims) { const ix = p.getIndices().getArray(); for (let t = 0; t < ix.length; t += 3) for (let k = 0; k < 3; k++) { const a = id[ix[t+k]], b = id[ix[t+(k+1)%3]]; const key = a < b ? a + ',' + b : b + ',' + a; cnt.set(key, (cnt.get(key) || 0) + 1); } }
  let open = 0, xs = [];
  const rev = []; for (const [k, v] of keyOf) rev[v] = k.split(',').map(Number);
  for (const [k, c] of cnt) if (c === 1) { open++; const [a] = k.split(',').map(Number); xs.push(rev[a][0] / 1e4); }
  xs.sort((a, b) => a - b);
  console.log(f.split('/').pop().padEnd(28), 'bordas abertas:', String(open).padStart(5), open ? `| x de ${xs[0].toFixed(2)} a ${xs[xs.length-1].toFixed(2)}, mediana ${xs[xs.length>>1].toFixed(2)}` : '');
}
