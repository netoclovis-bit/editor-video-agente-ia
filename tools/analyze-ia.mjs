import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [f, W, D, H] = [process.argv[2], ...process.argv.slice(3).map(Number)];
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f);
const pos = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray();
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[i + a]); mx[a] = Math.max(mx[a], pos[i + a]); }
const s = [W / (mx[0] - mn[0]), H / (mx[1] - mn[1]), D / (mx[2] - mn[2])];
const P = (i) => [(pos[i] - (mn[0] + mx[0]) / 2) * s[0], (pos[i + 1] - mn[1]) * s[1], (pos[i + 2] - (mn[2] + mx[2]) / 2) * s[2]];
// ocupação por fatia de altura (células de 3 cm)
const rows = [];
for (let y = 0; y < 0.36; y += 0.01) {
  const cells = new Set();
  for (let i = 0; i < pos.length; i += 3) { const p = P(i); if (p[1] >= y && p[1] < y + 0.01) cells.add(Math.round(p[0] / 0.03) + ',' + Math.round(p[2] / 0.03)); }
  rows.push(`${y.toFixed(2)}:${cells.size}`);
}
console.log('fatias', rows.join(' '));
// histograma de |x| na altura do braço/assento
const hist = {};
for (let i = 0; i < pos.length; i += 3) { const p = P(i); if (p[1] > 0.3 && p[1] < 0.6) { const k = (Math.floor(Math.abs(p[0]) * 100) / 100).toFixed(2); hist[k] = (hist[k] || 0) + 1; } }
console.log('|x| 0.30-0.60m', Object.entries(hist).sort((a, b) => a[0] - b[0]).map(([k, v]) => k + ':' + v).join(' '));
