// Perfil ao longo da largura para achar as emendas entre módulos (vales no topo do encosto e na frente do assento)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [f, W, D, H] = [process.argv[2], ...process.argv.slice(3).map(Number)];
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f);
const pos = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray();
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[i + a]); mx[a] = Math.max(mx[a], pos[i + a]); }
const s = [W / (mx[0] - mn[0]), H / (mx[1] - mn[1]), D / (mx[2] - mn[2])];
const N = Math.round(W / 0.02), top = new Float32Array(N).fill(0), front = new Float32Array(N).fill(-9), back = new Float32Array(N).fill(9);
for (let i = 0; i < pos.length; i += 3) {
  const x = (pos[i] - (mn[0] + mx[0]) / 2) * s[0], y = (pos[i + 1] - mn[1]) * s[1], z = (pos[i + 2] - (mn[2] + mx[2]) / 2) * s[2];
  const b = Math.min(N - 1, Math.max(0, Math.floor((x + W / 2) / 0.02)));
  if (y > top[b]) top[b] = y; if (z > front[b]) front[b] = z; if (z < back[b]) back[b] = z;
}
const xs = (b) => (-W / 2 + (b + 0.5) * 0.02).toFixed(2);
console.log('topo  :', [...top].map((v, b) => `${xs(b)}:${v.toFixed(2)}`).filter((_, b) => b % 2 === 0).join(' '));
console.log('frente:', [...front].map((v, b) => `${xs(b)}:${v.toFixed(2)}`).filter((_, b) => b % 4 === 0).join(' '));
// vales do topo
const mins = [];
for (let b = 3; b < N - 3; b++) { const w = top.slice(b - 3, b + 4); if (top[b] === Math.min(...w) && Math.max(...w) - top[b] > 0.012) mins.push(`${xs(b)} (${top[b].toFixed(2)})`); }
console.log('vales do topo:', mins.join(', '));
