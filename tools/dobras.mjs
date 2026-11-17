// Acha dobras/amassados: compara a malha com uma cópia bem alisada e lista as regiões (células de 4 cm) que mais se afastam
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld } from '@gltf-transform/functions';
const [file, yMin = '0', lim = '0.004', ITER = '30', XMAX = '9'] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
await doc.transform(weld());
const prims = doc.getRoot().listMeshes()[0].listPrimitives();
const pos = prims[0].getAttribute('POSITION').getArray(), N = pos.length / 3, nb = Array.from({ length: N }, () => new Set());
for (const p of prims) { const ix = p.getIndices().getArray(); for (let t = 0; t < ix.length; t += 3) for (let k = 0; k < 3; k++) { const a = ix[t + k], b = ix[t + (k + 1) % 3]; nb[a].add(b); nb[b].add(a); } }
const L = nb.map((s) => [...s]); let P = Float32Array.from(pos);
for (let it = 0; it < +ITER; it++) for (const f of [0.5, -0.53]) { const T = P.slice(); for (let i = 0; i < N; i++) { if (!L[i].length) continue; for (let j = 0; j < 3; j++) { let s = 0; for (const n of L[i]) s += T[n * 3 + j]; P[i * 3 + j] = T[i * 3 + j] + f * (s / L[i].length - T[i * 3 + j]); } } }
const cells = new Map(), c = 0.04;
for (let i = 0; i < N; i++) {
  if (pos[i * 3 + 1] < +yMin || pos[i * 3] > +XMAX) continue;
  const d = Math.hypot(pos[i * 3] - P[i * 3], pos[i * 3 + 1] - P[i * 3 + 1], pos[i * 3 + 2] - P[i * 3 + 2]);
  if (d < +lim) continue;
  const k = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]].map((v) => (Math.round(v / c) * c).toFixed(2)).join(' ');
  const o = cells.get(k) || { n: 0, m: 0 }; o.n++; o.m = Math.max(o.m, d); cells.set(k, o);
}
console.log('x y z -> vértices, maior desvio (mm)');
console.log([...cells.entries()].sort((a, b) => b[1].n * b[1].m - a[1].n * a[1].m).slice(0, 18).map(([k, o]) => `${k}: ${o.n}, ${(o.m * 1000).toFixed(0)}`).join('\n'));
