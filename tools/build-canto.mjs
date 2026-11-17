// Lazio de canto (em L), montado a partir do 3D do Lazio 2 módulos + chaise:
//   lado esquerdo = braço + 2 módulos (2,18 m) na parede do fundo
//   canto         = mesa de canto com tampo de madeira (0,90 x 0,90 m)
//   lado direito  = 1 módulo + chaise + braço (2,18 m, chaise 1,45 m) na parede da direita, girado 90°
// Uso: node build-canto.mjs <lazio.glb> <saida.glb>
import * as THREE from 'three';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsSheen, KHRMaterialsSpecular } from '@gltf-transform/extensions';
import { weld, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import fs from 'node:fs';
import path from 'node:path';
import { smoothNormals, boxUV, bakeAO, buildBVH, fabricNormalMap, roundedBox, cylinderPart, transformPart, T, mergeParts } from './lib.mjs';

const [SRC, OUT, MODO] = process.argv.slice(2);
const ESPELHADO = MODO === 'espelhado'; // chaise do lado esquerdo
const FROM = { W: 3.36, D: 1.45, H: 0.88 };          // Lazio 2 módulos + chaise (catálogo)
const SEAM_L = -0.47, SEAM_R = 0.50;                  // emendas medidas no 3D (coordenadas do Lazio 3,36 m)
const WING = 2.18, DEPTH = 0.90, CHAISE = 1.45, H = 0.88, CORNER = 0.90, LEG_TOP = 0.148;
const SIDE = WING + CORNER;                           // 3,08 m em cada parede

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
await MeshoptSimplifier.ready;

async function loadMesh(file, targetTris) {
  const doc = await io.read(file);
  for (const e of doc.getRoot().listExtensionsUsed()) e.dispose();
  const prim0 = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, targetTris / (prim0.getIndices().getCount() / 3)), error: 0.0008 }));
  const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  return { pos: Float32Array.from(p.getAttribute('POSITION').getArray()), idx: Uint32Array.from(p.getIndices().getArray()) };
}
function bounds(pos) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[i + a]); mx[a] = Math.max(mx[a], pos[i + a]); }
  return { mn, mx };
}
// centraliza em X/Z, apoia no chão e escala para W x H x D
function fit(pos, W, D, Hh) {
  const { mn, mx } = bounds(pos), s = [W / (mx[0] - mn[0]), Hh / (mx[1] - mn[1]), D / (mx[2] - mn[2])], out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    out[i] = (pos[i] - (mn[0] + mx[0]) / 2) * s[0]; out[i + 1] = (pos[i + 1] - mn[1]) * s[1]; out[i + 2] = (pos[i + 2] - (mn[2] + mx[2]) / 2) * s[2];
  }
  return out;
}
function compact(pos, idx) {
  const map = new Int32Array(pos.length / 3).fill(-1), np = [], ni = new Uint32Array(idx.length);
  for (let t = 0; t < idx.length; t++) { const v = idx[t]; if (map[v] < 0) { map[v] = np.length / 3; np.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); } ni[t] = map[v]; }
  return { pos: Float32Array.from(np), idx: ni };
}
// corta no plano x = x1 (mantém x < x1 se keepLess) e fecha o corte com uma tampa plana
function clipCap(pos, idx, x1, keepLess) {
  const sgn = keepLess ? 1 : -1, n = pos.length / 3;
  const beyond = new Uint8Array(n);
  for (let v = 0; v < n; v++) beyond[v] = sgn * (pos[v * 3] - x1) > 0 ? 1 : 0;
  const P = Float32Array.from(pos);
  for (let v = 0; v < n; v++) if (beyond[v]) P[v * 3] = x1;
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) if (!(beyond[idx[t]] && beyond[idx[t + 1]] && beyond[idx[t + 2]])) keep.push(idx[t], idx[t + 1], idx[t + 2]);
  // arestas de borda (usadas por um só triângulo) que ficaram no plano
  const cnt = new Map(), key = (a, b) => (a < b ? a * n + b : b * n + a);
  for (let t = 0; t < keep.length; t += 3) for (let k = 0; k < 3; k++) { const a = keep[t + k], b = keep[t + (k + 1) % 3]; cnt.set(key(a, b), (cnt.get(key(a, b)) || 0) + 1); }
  const next = new Map(), onPlane = (v) => Math.abs(P[v * 3] - x1) < 1e-6;
  for (let t = 0; t < keep.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = keep[t + k], b = keep[t + (k + 1) % 3];
    if (cnt.get(key(a, b)) === 1 && onPlane(a) && onPlane(b)) next.set(b, a); // a tampa percorre a borda no sentido contrário
  }
  const used = new Set(), caps = [];
  let loops = 0, capTris = 0;
  for (const start of next.keys()) {
    if (used.has(start)) continue;
    const loop = []; let v = start, guard = 0;
    while (v !== undefined && !used.has(v) && guard++ < 200000) { used.add(v); loop.push(v); v = next.get(v); }
    if (loop.length < 3 || v !== start) continue;
    const contour = loop.map((u) => new THREE.Vector2(P[u * 3 + 2], P[u * 3 + 1]));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const f of faces) {
      let [a, b, c] = f.map((i) => loop[i]);
      // normal da tampa apontando para fora do corte (+x se keepLess, -x se não)
      const e1z = P[b * 3 + 2] - P[a * 3 + 2], e1y = P[b * 3 + 1] - P[a * 3 + 1], e2z = P[c * 3 + 2] - P[a * 3 + 2], e2y = P[c * 3 + 1] - P[a * 3 + 1];
      const nx = e1y * e2z - e1z * e2y;
      if (sgn * nx < 0) [b, c] = [c, b];
      caps.push(a, b, c); capTris++;
    }
    loops++;
  }
  console.log(`  corte em x=${x1}: ${loops} contorno(s) fechado(s), ${capTris} triângulos de tampa`);
  return compact(P, Uint32Array.from([...keep, ...caps]));
}
function transform(pos, { rotY = 0, tx = 0, tz = 0 }) {
  const c = Math.cos(rotY), s = Math.sin(rotY), out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], z = pos[i + 2];
    out[i] = x * c + z * s + tx; out[i + 1] = pos[i + 1]; out[i + 2] = -x * s + z * c + tz;
  }
  return out;
}

const src = await loadMesh(SRC, 70000);
const base = fit(src.pos, FROM.W, FROM.D, FROM.H);
// altura do assento: topo do módulo esquerdo na frente
let seatY = 0;
for (let i = 0; i < base.length; i += 3) if (base[i] > -1.2 && base[i] < -0.7 && base[i + 2] > 0.05 && base[i + 2] < 0.2) seatY = Math.max(seatY, base[i + 1]);
console.log('altura do assento ≈', seatY.toFixed(3));

// lado esquerdo: braço + 2 módulos (corta antes da chaise)
let L = clipCap(base, src.idx, SEAM_R, true);
L = { pos: fit(L.pos, WING, DEPTH, H), idx: L.idx };
L.pos = transform(L.pos, { tx: WING / 2, tz: DEPTH / 2 });                         // x 0..2,18, encosto em z = 0
// lado direito: 1 módulo + chaise + braço, girado -90° (frente para -x), encosto na parede x = 3,08
let R = clipCap(base, src.idx, SEAM_L, false);
R = { pos: fit(R.pos, WING, CHAISE, H), idx: R.idx };
R.pos = transform(R.pos, { rotY: -Math.PI / 2, tx: SIDE - CHAISE / 2, tz: CORNER + WING / 2 });

const wings = mergeParts([
  { pos: L.pos, idx: L.idx, nrm: smoothNormals(L.pos, L.idx) },
  { pos: R.pos, idx: R.idx, nrm: smoothNormals(R.pos, R.idx) },
]);
// grupos: 0 tecido, 2 pés de metal (abaixo do assento), 3 madeira clara (tampo do canto)
const groups = [[], [], [], []];
for (let t = 0; t < wings.idx.length; t += 3) {
  const a = wings.idx[t] * 3, b = wings.idx[t + 1] * 3, c = wings.idx[t + 2] * 3;
  const cy = (wings.pos[a + 1] + wings.pos[b + 1] + wings.pos[c + 1]) / 3;
  groups[cy < LEG_TOP ? 2 : 0].push(wings.idx[t], wings.idx[t + 1], wings.idx[t + 2]);
}
// mesa de canto: tampo de madeira na altura do assento, base preta recuada
const topY = Math.max(0.36, seatY - 0.02), topT = 0.035, cx = WING + CORNER / 2, cz = CORNER / 2;
const tableTop = transformPart(roundedBox({ size: [CORNER - 0.02, topT, CORNER - 0.02], r: 0.012, density: 0.06, k: 2 }), T(cx, topY - topT / 2, cz));
const tableBase = transformPart(roundedBox({ size: [CORNER - 0.24, topY - topT - 0.14, CORNER - 0.24], r: 0.02, density: 0.08, k: 2 }), T(cx, 0.14 + (topY - topT - 0.14) / 2, cz));
const legs = [];
for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) legs.push(transformPart(cylinderPart(0.012, 0.009, 0.15), T(cx + dx * (CORNER / 2 - 0.16), 0.075, cz + dz * (CORNER / 2 - 0.16))));
const extra = [[tableTop, 3], [tableBase, 2], ...legs.map((l) => [l, 2])];

// junta tudo, centraliza o L em x/z
const all = mergeParts([wings, ...extra.map(([p]) => p)]);
let off = wings.pos.length / 3, toff = 0;
for (const [p, g] of extra) { for (let i = 0; i < p.idx.length; i++) groups[g].push(p.idx[i] + off); off += p.pos.length / 3; }
for (let i = 0; i < all.pos.length; i += 3) { all.pos[i] -= SIDE / 2; all.pos[i + 2] -= SIDE / 2; }
if (ESPELHADO) {
  // reflete em X (chaise passa para a esquerda) e inverte o sentido dos triângulos
  for (let i = 0; i < all.pos.length; i += 3) { all.pos[i] = -all.pos[i]; all.nrm[i] = -all.nrm[i]; }
  const flip = (arr) => { for (let t = 0; t < arr.length; t += 3) { const b = arr[t + 1]; arr[t + 1] = arr[t + 2]; arr[t + 2] = b; } };
  flip(all.idx); groups.forEach(flip);
}
const floor = (() => { const g = new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2); return { pos: Float32Array.from(g.attributes.position.array), nrm: Float32Array.from(g.attributes.normal.array), idx: Uint32Array.from(g.index.array) }; })();
all.ao = bakeAO(all, buildBVH([all, floor]), 0.25);

const normalJpg = await fabricNormalMap(path.join(path.dirname(OUT), '_normal.jpg'));
const doc = new Document(), buffer = doc.createBuffer();
const sheenExt = doc.createExtension(KHRMaterialsSheen), specExt = doc.createExtension(KHRMaterialsSpecular);
const tex = doc.createTexture('tecido_normal').setImage(normalJpg).setMimeType('image/jpeg');
const fabric = doc.createMaterial('Tecido').setBaseColorFactor([0.30, 0.31, 0.32, 1]).setRoughnessFactor(0.92).setMetallicFactor(0).setNormalTexture(tex).setNormalScale(0.55);
fabric.setExtension('KHR_materials_sheen', sheenExt.createSheen().setSheenColorFactor([0.5, 0.5, 0.52]).setSheenRoughnessFactor(0.55));
fabric.setExtension('KHR_materials_specular', specExt.createSpecular().setSpecularFactor(0.25));
const mats = [fabric,
  doc.createMaterial('Madeira').setBaseColorFactor([0.21, 0.08, 0.03, 1]).setRoughnessFactor(0.42).setMetallicFactor(0),
  doc.createMaterial('Pes').setBaseColorFactor([0.025, 0.022, 0.02, 1]).setRoughnessFactor(0.45).setMetallicFactor(0),
  doc.createMaterial('MadeiraClara').setBaseColorFactor([0.36, 0.22, 0.11, 1]).setRoughnessFactor(0.5).setMetallicFactor(0)];
const n = all.pos.length / 3, color = new Uint8Array(n * 4);
for (let i = 0; i < n; i++) { const v = Math.round(all.ao[i] * 255); color.set([v, v, v, 255], i * 4); }
const acc = {
  POSITION: doc.createAccessor().setType('VEC3').setArray(all.pos).setBuffer(buffer),
  NORMAL: doc.createAccessor().setType('VEC3').setArray(all.nrm).setBuffer(buffer),
  COLOR_0: doc.createAccessor().setType('VEC4').setArray(color).setNormalized(true).setBuffer(buffer),
  TEXCOORD_0: doc.createAccessor().setType('VEC2').setArray(boxUV(all)).setBuffer(buffer),
};
const mesh = doc.createMesh('Estrutura');
groups.forEach((g, k) => {
  if (!g.length) return;
  const p = doc.createPrimitive().setMaterial(mats[k]);
  for (const [s, a] of Object.entries(acc)) if (k === 0 || s !== 'TEXCOORD_0') p.setAttribute(s, a);
  p.setIndices(doc.createAccessor().setType('SCALAR').setArray(n < 65535 ? Uint16Array.from(g) : Uint32Array.from(g)).setBuffer(buffer));
  mesh.addPrimitive(p);
});
doc.createScene('Cena').addChild(doc.createNode('Sofa').setMesh(mesh));
doc.getRoot().getAsset().generator = 'Provador 3D Artflex (Lazio de canto montado do 3D das fotos)';
await new NodeIO().registerExtensions([KHRMaterialsSheen, KHRMaterialsSpecular]).write(OUT, doc);
fs.rmSync(path.join(path.dirname(OUT), '_normal.jpg'));
const { mn, mx } = bounds(all.pos), r = (x) => Math.round(x * 100) / 100;
console.log(path.basename(OUT), 'medido', r(mx[0] - mn[0]), 'x', r(mx[2] - mn[2]), 'x', r(mx[1] - mn[1]), '| tris', all.idx.length / 3, '| grupos', groups.map((g) => g.length / 3).join('/'), '|', (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB');
