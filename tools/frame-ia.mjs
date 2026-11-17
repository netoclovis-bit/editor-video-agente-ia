import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[2]);
const pos = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray();
const [W, D, H] = process.argv.slice(3).map(Number);
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[i + a]); mx[a] = Math.max(mx[a], pos[i + a]); }
const s = [W / (mx[0] - mn[0]), H / (mx[1] - mn[1]), D / (mx[2] - mn[2])];
for (const xt of (process.env.XT || "0.30,0.32,0.335").split(",").map(Number)) {
  const rows = [];
  for (let y = 0.22; y < 0.90; y += 0.04) {
    const zs = [];
    for (let i = 0; i < pos.length; i += 3) {
      const x = Math.abs((pos[i] - (mn[0] + mx[0]) / 2) * s[0]), yy = (pos[i + 1] - mn[1]) * s[1], z = (pos[i + 2] - (mn[2] + mx[2]) / 2) * s[2];
      if (x > xt && yy >= y && yy < y + 0.04) zs.push(Math.round(z * 50) / 50);
    }
    const u = [...new Set(zs)].sort((a, b) => a - b);
    // agrupa em intervalos contíguos
    const iv = []; for (const z of u) { if (iv.length && z - iv[iv.length - 1][1] <= 0.021) iv[iv.length - 1][1] = z; else iv.push([z, z]); }
    rows.push(`y${y.toFixed(2)}: ${iv.map((a) => a[0].toFixed(2) + '..' + a[1].toFixed(2)).join(' ')}`);
  }
  console.log('|x|>' + xt + '\n  ' + rows.join('\n  '));
}
