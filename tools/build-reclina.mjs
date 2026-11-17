// Poltronas reclináveis (3D das fotos, peça única): cria a animação "Abrir"
//  - encosto inclina para trás (malha com "pele": o tecido dobra na junção com o assento e nas abas)
//  - painel de baixo da frente vira o apoio de pés: sai girando para a frente e sobe até perto do assento
//  - atrás do painel fica um vão forrado (sombra) e hastes de metal ligam o apoio de pés à poltrona
// Uso: node build-reclina.mjs <entrada.glb> <saida.glb> <doha|dalian>
import { NodeIO } from '@gltf-transform/core';
import { KHRMaterialsSheen, KHRMaterialsSpecular } from '@gltf-transform/extensions';
import * as THREE from 'three';

const [IN, OUT, NAME] = process.argv.slice(2);
const CFG = {
  // pé: painel da frente entre os braços (|x| < x, y0..y1, z > z); costas: pivô (y,z), braços |x| > armX, abas acima de wingY e atrás de wingZ
  doha: { foot: { x: 0.245, y0: 0.07, y1: 0.262, z: 0.30, thick: 0.065, cav: 0.11, yOpen: 0.405, dz: 0.085, ang: -86 },
    back: { yP: 0.46, zP: -0.28, zS: -0.13, armX: 0.27, armTop: 0.65, wingY: [0.42, 0.64], wingZ: [-0.12, -0.24], topBand: [-0.02, 0.14], armBlend: [0.06, 0.06], ang: -24 } },
  dalian: { foot: { x: 0.235, y0: 0.07, y1: 0.25, z: 0.33, thick: 0.065, cav: 0.11, yOpen: 0.43, dz: 0.085, ang: -86 },
    back: { yP: 0.48, zP: -0.24, zS: -0.04, armX: 0.23, armTop: 0.63, wingY: [0.40, 0.62], wingZ: [-0.08, -0.20], topBand: [-0.02, 0.14], armBlend: [0.06, 0.06], ang: -24 } },
}[NAME];
CFG.back.topBand ??= [0.03, 0.09]; CFG.back.armBlend ??= [0.03, 0.02];
if (process.env.TUNE) Object.assign(CFG.back, JSON.parse(process.env.TUNE));
const ANIM = 1.2;

const io = new NodeIO().registerExtensions([KHRMaterialsSheen, KHRMaterialsSpecular]);
const doc = await io.read(IN);
const root = doc.getRoot(), buffer = root.listBuffers()[0];
const mesh = root.listMeshes()[0], prims = mesh.listPrimitives();
const pFab = prims.find((p) => p.getMaterial().getName() === 'Tecido'), pPes = prims.find((p) => p.getMaterial().getName() !== 'Tecido');
const fabricMat = pFab.getMaterial();

// ---------- vértices (posição, normal, cor/AO, uv) em listas que crescem ----------
const P = [...pFab.getAttribute('POSITION').getArray()], N = [...pFab.getAttribute('NORMAL').getArray()];
const C = [...pFab.getAttribute('COLOR_0').getArray()], U = [...pFab.getAttribute('TEXCOORD_0').getArray()];
let tris = []; // [a,b,c,mat] mat 0 tecido, 1 pés
for (const [p, m] of [[pFab, 0], [pPes, 1]]) { const ix = p.getIndices().getArray(); for (let t = 0; t < ix.length; t += 3) tris.push([ix[t], ix[t + 1], ix[t + 2], m]); }
const nV = () => P.length / 3;
const V = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];

// corta todos os triângulos que cruzam o plano (eixo = valor), repartindo as arestas (sem rachaduras)
function splitPlane(axis, value) {
  const cache = new Map();
  const mid = (a, b) => {
    const k = a < b ? a + '_' + b : b + '_' + a; let v = cache.get(k); if (v !== undefined) return v;
    const s = (value - P[a * 3 + axis]) / (P[b * 3 + axis] - P[a * 3 + axis]); v = nV();
    for (let j = 0; j < 3; j++) P.push(P[a * 3 + j] + s * (P[b * 3 + j] - P[a * 3 + j]));
    P[v * 3 + axis] = value;
    const n = [0, 1, 2].map((j) => N[a * 3 + j] + s * (N[b * 3 + j] - N[a * 3 + j])), L = Math.hypot(...n) || 1; N.push(...n.map((q) => q / L));
    for (let j = 0; j < 4; j++) C.push(Math.round(C[a * 4 + j] + s * (C[b * 4 + j] - C[a * 4 + j])));
    for (let j = 0; j < 2; j++) U.push(U[a * 2 + j] + s * (U[b * 2 + j] - U[a * 2 + j]));
    cache.set(k, v); return v;
  };
  const out = [];
  for (const t of tris) {
    const d = [0, 1, 2].map((k) => P[t[k] * 3 + axis] - value);
    const sg = d.map((q) => (q > 1e-7 ? 1 : q < -1e-7 ? -1 : 0));
    if (!(sg.includes(1) && sg.includes(-1))) { out.push(t); continue; }
    // vértice sozinho de um lado
    let lone = -1;
    for (let k = 0; k < 3; k++) { const o1 = sg[(k + 1) % 3], o2 = sg[(k + 2) % 3]; if (sg[k] !== 0 && o1 !== sg[k] && o2 !== sg[k]) { lone = k; break; } }
    const A = t[lone], B = t[(lone + 1) % 3], Cc = t[(lone + 2) % 3], m = t[3];
    const sB = sg[(lone + 1) % 3], sC = sg[(lone + 2) % 3];
    if (sB === 0) { const AC = mid(A, Cc); out.push([A, B, AC, m], [B, Cc, AC, m]); continue; }
    if (sC === 0) { const AB = mid(A, B); out.push([A, AB, Cc, m], [AB, B, Cc, m]); continue; }
    const AB = mid(A, B), AC = mid(A, Cc);
    out.push([A, AB, AC, m], [AB, B, Cc, m], [AB, Cc, AC, m]);
  }
  tris = out;
}
const F = CFG.foot, B = CFG.back;
splitPlane(0, -F.x); splitPlane(0, F.x); splitPlane(1, F.y0); splitPlane(1, F.y1);

// ---------- painel do apoio de pés: triângulos de tecido dentro do retângulo, na frente ----------
const inPanel = (t) => {
  if (t[3] !== 0) return false;
  const c = [0, 1, 2].map((j) => (P[t[0] * 3 + j] + P[t[1] * 3 + j] + P[t[2] * 3 + j]) / 3);
  return Math.abs(c[0]) < F.x && c[1] > F.y0 && c[1] < F.y1 && c[2] > F.z;
};
const panel = tris.filter(inPanel), body = tris.filter((t) => !inPanel(t));
// borda do painel (arestas usadas uma vez só dentro do painel), no sentido dos triângulos do painel
function boundaryLoops(ts) {
  const cnt = new Map(), key = (a, b) => (a < b ? a + '_' + b : b + '_' + a);
  for (const t of ts) for (let k = 0; k < 3; k++) { const kk = key(t[k], t[(k + 1) % 3]); cnt.set(kk, (cnt.get(kk) || 0) + 1); }
  const next = new Map();
  for (const t of ts) for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3]; if (cnt.get(key(a, b)) === 1) next.set(a, b); }
  const used = new Set(), loops = [];
  for (const s of next.keys()) {
    if (used.has(s)) continue;
    const loop = []; let v = s;
    while (v !== undefined && !used.has(v)) { used.add(v); loop.push(v); v = next.get(v); }
    loops.push(loop);
  }
  return loops;
}
const loops = boundaryLoops(panel);
loops.sort((a, b) => b.length - a.length);
console.log(NAME, 'painel:', panel.length, 'triângulos; contornos:', loops.map((l) => l.length).join(','));
const loop = loops[0];

// ---------- peças novas ----------
function flatPart(triList) { // lista de [p1,p2,p3] -> posições e normais retas
  const pos = [], nrm = [];
  for (const [a, b, c] of triList) {
    const e1 = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), e2 = new THREE.Vector3(...c).sub(new THREE.Vector3(...a));
    const n = e1.cross(e2).normalize();
    for (const p of [a, b, c]) { pos.push(...p); nrm.push(n.x, n.y, n.z); }
  }
  return { pos, nrm };
}
const off = (i, dz) => { const v = V(i); v[2] -= dz; return v; };
// vão escuro: paredes que continuam a superfície do corpo para dentro + fundo plano
const cav = [];
for (let k = 0; k < loop.length; k++) {
  const a = loop[k], b = loop[(k + 1) % loop.length]; // aresta a->b no sentido do painel; no corpo é b->a
  cav.push([V(a), V(b), off(b, F.cav)], [V(a), off(b, F.cav), off(a, F.cav)]);
}
{
  const contour = loop.map((i) => new THREE.Vector2(P[i * 3], P[i * 3 + 1]));
  for (const f of THREE.ShapeUtils.triangulateShape(contour, [])) {
    let [a, b, c] = f.map((i) => off(loop[i], F.cav));
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (nz < 0) [b, c] = [c, b]; // fundo virado para a frente
    cav.push([a, b, c]);
  }
}
// apoio de pés: frente = painel original; laterais e fundo com espessura
const hinge = [0, F.y1, Math.max(...loop.filter((i) => Math.abs(P[i * 3 + 1] - F.y1) < 1e-6).map((i) => P[i * 3 + 2]))];
// o fundo do apoio é 6 mm menor em cada lado: as laterais inclinam para dentro e não brigam com as paredes do vão
const cy = (F.y0 + F.y1) / 2, sx = (F.x - 0.006) / F.x, sy = ((F.y1 - F.y0) / 2 - 0.006) / ((F.y1 - F.y0) / 2);
const offF = (i) => { const v = V(i); return [v[0] * sx, cy + (v[1] - cy) * sy, v[2] - F.thick]; };
const footSide = [];
for (let k = 0; k < loop.length; k++) {
  const a = loop[k], b = loop[(k + 1) % loop.length];
  footSide.push([V(b), V(a), offF(a)], [V(b), offF(a), offF(b)]);
}
for (const t of panel) footSide.push([offF(t[0]), offF(t[2]), offF(t[1])]);

// ---------- pele do encosto: peso 0 (fixo) a 1 (vai com o encosto) ----------
const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function backWeight(x, y, z) {
  const center = ss(B.yP - 0.04, B.yP + 0.06, y) * ss(B.zS + 0.05, B.zS - 0.03, z);
  // abas: atrás do braço a partir de wingY; acima do braço, tudo vai com o encosto
  const wing = Math.max(ss(B.wingY[0], B.wingY[1], y) * ss(B.wingZ[0], B.wingZ[1], z), ss(B.armTop + B.topBand[0], B.armTop + B.topBand[1], y));
  const a = ss(B.armX - B.armBlend[0], B.armX + B.armBlend[1], Math.abs(x));
  return center * (1 - a) + wing * a;
}

// ---------- gravar ----------
// corpo: só os vértices usados
const map = new Int32Array(nV()).fill(-1), bp = [], bn = [], bc = [], bu = [], bj = [], bw = [];
const fabIdx = [], pesIdx = [];
for (const t of body) for (let k = 0; k < 3; k++) {
  const v = t[k];
  if (map[v] < 0) {
    map[v] = bp.length / 3;
    bp.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); bn.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
    bc.push(C[v * 4], C[v * 4 + 1], C[v * 4 + 2], C[v * 4 + 3]); bu.push(U[v * 2], U[v * 2 + 1]);
    const w = backWeight(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    const w8 = Math.round(w * 255); bj.push(0, 1, 0, 0); bw.push(255 - w8, w8, 0, 0);
  }
  (t[3] === 0 ? fabIdx : pesIdx).push(map[v]);
}
const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
const old = new Set([...pFab.listAttributes(), ...pPes.listAttributes(), pFab.getIndices(), pPes.getIndices()]);
const A = {
  POSITION: acc('VEC3', Float32Array.from(bp)), NORMAL: acc('VEC3', Float32Array.from(bn)),
  COLOR_0: acc('VEC4', Uint8Array.from(bc)).setNormalized(true), TEXCOORD_0: acc('VEC2', Float32Array.from(bu)),
  JOINTS_0: acc('VEC4', Uint8Array.from(bj)), WEIGHTS_0: acc('VEC4', Uint8Array.from(bw)).setNormalized(true),
};
for (const [p, ix] of [[pFab, fabIdx], [pPes, pesIdx]]) {
  for (const s of p.listSemantics()) p.setAttribute(s, null);
  for (const [s, a] of Object.entries(A)) if (p === pFab || s !== 'TEXCOORD_0') p.setAttribute(s, a);
  p.setIndices(acc('SCALAR', Uint32Array.from(ix)));
}
for (const a of old) a.dispose();

// apoio de pés (relativo à dobradiça) e vão
function partMesh(name, mat, front, flat, origin, ao) {
  const pos = [], nrm = [], col = [], idx = [];
  const base = new Map();
  for (const t of front) for (let k = 0; k < 3; k++) { // frente: vértices originais, normais suaves e AO
    const v = t[k]; let i = base.get(v);
    if (i === undefined) { i = pos.length / 3; base.set(v, i); pos.push(P[v * 3] - origin[0], P[v * 3 + 1] - origin[1], P[v * 3 + 2] - origin[2]); nrm.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); col.push(C[v * 4], C[v * 4 + 1], C[v * 4 + 2], 255); }
    idx.push(i);
  }
  const f = flatPart(flat);
  for (let i = 0; i < f.pos.length / 3; i++) { idx.push(pos.length / 3); pos.push(f.pos[i * 3] - origin[0], f.pos[i * 3 + 1] - origin[1], f.pos[i * 3 + 2] - origin[2]); nrm.push(f.nrm[i * 3], f.nrm[i * 3 + 1], f.nrm[i * 3 + 2]); col.push(ao, ao, ao, 255); }
  // uv no mesmo esquema do tecido (projeção pela face dominante)
  const uv = [];
  for (let i = 0; i < pos.length / 3; i++) {
    const x = pos[i * 3] + origin[0], y = pos[i * 3 + 1] + origin[1], z = pos[i * 3 + 2] + origin[2];
    const ax = Math.abs(nrm[i * 3]), ay = Math.abs(nrm[i * 3 + 1]), az = Math.abs(nrm[i * 3 + 2]);
    let u, w; if (ay >= ax && ay >= az) { u = x; w = z; } else if (ax >= az) { u = z; w = y; } else { u = x; w = y; }
    uv.push(u * 4, w * 4);
  }
  const p = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', acc('VEC3', Float32Array.from(pos))).setAttribute('NORMAL', acc('VEC3', Float32Array.from(nrm)))
    .setAttribute('COLOR_0', acc('VEC4', Uint8Array.from(col)).setNormalized(true)).setAttribute('TEXCOORD_0', acc('VEC2', Float32Array.from(uv)))
    .setIndices(acc('SCALAR', Uint32Array.from(idx)));
  return doc.createMesh(name).addPrimitive(p);
}
// vão atrás do apoio: forrado com o mesmo tecido, mais escuro (sombra), em vez de um buraco preto
const metalMat = doc.createMaterial('Mecanismo').setBaseColorFactor([0.075, 0.075, 0.08, 1]).setRoughnessFactor(0.45).setMetallicFactor(0.7);
const footMesh = partMesh('ApoioPes', fabricMat, panel, footSide, hinge, 200);
const cavMesh = partMesh('Vao', fabricMat, [], cav, [0, 0, 0], 50);
// haste metálica: caixa de 1 m ao longo de +z (a animação estica até o tamanho certo)
function barMesh() {
  const w = 0.005, h = 0.012, c = [];
  const v = (x, y, z) => [x, y, z];
  const q = (a, b, c2, d) => { c.push([a, b, c2], [a, c2, d]); };
  const p = [v(-w, -h, 0), v(w, -h, 0), v(w, h, 0), v(-w, h, 0), v(-w, -h, 1), v(w, -h, 1), v(w, h, 1), v(-w, h, 1)];
  q(p[0], p[3], p[2], p[1]); q(p[4], p[5], p[6], p[7]); q(p[0], p[1], p[5], p[4]); q(p[3], p[7], p[6], p[2]); q(p[1], p[2], p[6], p[5]); q(p[0], p[4], p[7], p[3]);
  const f = flatPart(c);
  const prim = doc.createPrimitive().setMaterial(metalMat)
    .setAttribute('POSITION', acc('VEC3', Float32Array.from(f.pos))).setAttribute('NORMAL', acc('VEC3', Float32Array.from(f.nrm)))
    .setIndices(acc('SCALAR', Uint32Array.from(f.pos.map((_, i) => i).filter((i) => i < f.pos.length / 3))));
  return doc.createMesh('Haste').addPrimitive(prim);
}
const barM = barMesh();

// ---------- nós, esqueleto e animação ----------
const scene = root.listScenes()[0], sofaNode = root.listNodes().find((n) => n.getMesh() === mesh);
const pivot = [0, B.yP, B.zP];
const nBase = doc.createNode('Base'), nBack = doc.createNode('Encosto').setTranslation(pivot);
nBase.addChild(nBack); scene.addChild(nBase);
const ibm = acc('MAT4', Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -pivot[0], -pivot[1], -pivot[2], 1]));
const skin = doc.createSkin('Poltrona').addJoint(nBase).addJoint(nBack).setSkeleton(nBase).setInverseBindMatrices(ibm);
sofaNode.setSkin(skin);
const nFoot = doc.createNode('ApoioPes').setMesh(footMesh).setTranslation(hinge);
scene.addChild(nFoot);
scene.addChild(doc.createNode('Vao').setMesh(cavMesh));

const qx = (deg) => { const r = (deg * Math.PI) / 360; return [Math.sin(r), 0, 0, Math.cos(r)]; };
// encosto começa um pouco depois do pé
const bT = [0, 0.25, 0.7, ANIM], bA = [0, 0, B.ang * 0.55, B.ang];
// pé: sai para a frente, gira e sobe até perto do assento
const fT = [0, 0.3, 0.6, 0.9, ANIM], fDy = [0, 0.1, 0.35, 0.8, 1], fDz = [0, 0.6, 1, 0.95, 0.9], fA = [0, -22, -55, -80, F.ang];
const sampler = (times, vals, type) => doc.createAnimationSampler().setInput(acc('SCALAR', Float32Array.from(times))).setOutput(acc(type, Float32Array.from(vals.flat()))).setInterpolation('LINEAR');
const sBack = sampler(bT, bA.map(qx), 'VEC4');
const sFootR = sampler(fT, fA.map(qx), 'VEC4');
const sFootT = sampler(fT, fT.map((_, i) => [0, hinge[1] + fDy[i] * (F.yOpen - hinge[1]), hinge[2] + fDz[i] * F.dz]), 'VEC3');
const anim = doc.createAnimation('Abrir').addSampler(sBack).addSampler(sFootR).addSampler(sFootT)
  .addChannel(doc.createAnimationChannel().setTargetNode(nBack).setTargetPath('rotation').setSampler(sBack))
  .addChannel(doc.createAnimationChannel().setTargetNode(nFoot).setTargetPath('rotation').setSampler(sFootR))
  .addChannel(doc.createAnimationChannel().setTargetNode(nFoot).setTargetPath('translation').setSampler(sFootT));

// ---------- mecanismo: hastes de metal ligando o vão ao lado de baixo do apoio de pés ----------
// posição do apoio no tempo t (mesma interpolação linear da animação acima)
const lerpKeys = (times, vals, t) => {
  if (t <= times[0]) return vals[0];
  for (let i = 1; i < times.length; i++) if (t <= times[i]) { const k = (t - times[i - 1]) / (times[i] - times[i - 1]); return vals[i - 1] + k * (vals[i] - vals[i - 1]); }
  return vals[vals.length - 1];
};
const footPoint = (t, ly, lz) => {
  const a = (lerpKeys(fT, fA, t) * Math.PI) / 180, dy = lerpKeys(fT, fDy, t), dz = lerpKeys(fT, fDz, t);
  const ty = hinge[1] + dy * (F.yOpen - hinge[1]), tz = hinge[2] + dz * F.dz;
  return [ty + ly * Math.cos(a) - lz * Math.sin(a), tz + ly * Math.sin(a) + lz * Math.cos(a)];
};
const zPiv = hinge[2] - F.cav + 0.015, H = F.y1 - F.y0;
const LINKS = [ // [pivô no corpo (y), ponto no apoio (ly)]
  [F.y1 - 0.03, -0.05],
  [F.y0 + 0.05, -Math.min(0.13, H * 0.68)],
];
const NS = 30, times = Array.from({ length: NS + 1 }, (_, k) => (k * ANIM) / NS);
let maxLen = 0;
for (const sx of [-1, 1]) for (const [yPiv, ly] of LINKS) {
  const x = sx * (F.x - 0.03);
  const node = doc.createNode('Haste').setMesh(barM).setTranslation([x, yPiv, zPiv]);
  scene.addChild(node);
  const rots = [], scl = [];
  for (const t of times) {
    const [py, pz] = footPoint(t, ly, -F.thick + 0.004);
    const dy = py - yPiv, dz = pz - zPiv, L = Math.hypot(dy, dz), th = Math.atan2(-dy, dz);
    rots.push([Math.sin(th / 2), 0, 0, Math.cos(th / 2)]); scl.push([1, 1, Math.max(L, 0.001)]); maxLen = Math.max(maxLen, L);
  }
  const sR = sampler(times, rots, 'VEC4'), sS = sampler(times, scl, 'VEC3');
  node.setRotation(rots[0]).setScale(scl[0]);
  anim.addSampler(sR).addSampler(sS)
    .addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(sR))
    .addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('scale').setSampler(sS));
}
console.log(NAME, 'mecanismo: 4 hastes, até', maxLen.toFixed(2), 'm');
root.getAsset().generator = 'Provador 3D Artflex (forma por IA, medidas do catálogo, reclinável animada)';
await io.write(OUT, doc);

// ---------- medidas aproximadas reclinada (para a trena) ----------
const rot = (deg, y, z) => { const r = (deg * Math.PI) / 180; return [y * Math.cos(r) - z * Math.sin(r), y * Math.sin(r) + z * Math.cos(r)]; };
let zMin = 1e9, zMax = -1e9, yMax = -1e9;
for (let i = 0; i < bp.length / 3; i++) {
  const w = bw[i * 4 + 1] / 255; let y = bp[i * 3 + 1], z = bp[i * 3 + 2];
  const [ry, rz] = rot(B.ang, y - pivot[1], z - pivot[2]);
  y = (1 - w) * y + w * (ry + pivot[1]); z = (1 - w) * z + w * (rz + pivot[2]);
  zMin = Math.min(zMin, z); zMax = Math.max(zMax, z); yMax = Math.max(yMax, y);
}
const hEnd = [hinge[1] + (F.yOpen - hinge[1]), hinge[2] + 0.9 * F.dz];
for (const t of [...panel.flat().filter((v, i) => i % 4 !== 3)]) {
  const [ry, rz] = rot(F.ang, P[t * 3 + 1] - hinge[1], P[t * 3 + 2] - hinge[2]);
  zMax = Math.max(zMax, rz + hEnd[1]);
}
let z0 = 1e9, z1 = -1e9; for (let i = 2; i < bp.length; i += 3) { z0 = Math.min(z0, bp[i]); z1 = Math.max(z1, bp[i]); }
if (process.env.DEBUG) { // triângulos deformados (área muito menor/maior) reclinada, agrupados por região
  const def = (i) => { const w = bw[i * 4 + 1] / 255, y = bp[i * 3 + 1], z = bp[i * 3 + 2]; const [ry, rz] = rot(B.ang, y - pivot[1], z - pivot[2]); return [bp[i * 3], (1 - w) * y + w * (ry + pivot[1]), (1 - w) * z + w * (rz + pivot[2])]; };
  const area = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); };
  const bucket = new Map(); const all = [...fabIdx];
  for (let t = 0; t < all.length; t += 3) {
    const ids = [all[t], all[t + 1], all[t + 2]], a0 = area(...ids.map((i) => [bp[i * 3], bp[i * 3 + 1], bp[i * 3 + 2]])), a1 = area(...ids.map(def));
    if (a0 < 1e-9) continue; const r = a1 / a0;
    if (r < 0.5 || r > 2.2) { const c = ids.map((i) => [bp[i * 3], bp[i * 3 + 1], bp[i * 3 + 2]]).reduce((s, p) => s.map((q, j) => q + p[j] / 3), [0, 0, 0]);
      const k = [Math.round(Math.abs(c[0]) / 0.03) * 0.03, Math.round(c[1] / 0.05) * 0.05, Math.round(c[2] / 0.05) * 0.05].map((q) => q.toFixed(2)).join(' '); bucket.set(k, (bucket.get(k) || 0) + 1); }
  }
  console.log('total deformados', [...bucket.values()].reduce((a, b) => a + b, 0)); console.log('deformados |x| y z -> n:', [...bucket.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => k + ':' + n).join('  '));
}
const r2 = (x) => Math.round(x * 100) / 100;
console.log(NAME, 'reclinada (aprox.): fundo', r2(zMax - zMin), 'm | recua atrás', r2(z0 - zMin), 'm | avança na frente', r2(zMax - z1), 'm | altura', r2(yMax), 'm');
console.log(JSON.stringify({ reclinada: { fundo: r2(zMax - zMin), recuo: r2(z0 - zMin), altura: r2(yMax) } }));
