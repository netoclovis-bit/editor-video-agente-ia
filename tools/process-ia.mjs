// Prepara os 3D gerados por IA (Hunyuan3D, só forma) para o provador:
// medidas do catálogo, pés/moldura em madeira ou plástico, tecido com sombras (AO) e textura.
// Uso: node process-ia.mjs <pasta-entrada> <pasta-saida> [ids...]
import * as THREE from 'three';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsSheen, KHRMaterialsSpecular } from '@gltf-transform/extensions';
import { weld, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import fs from 'node:fs';
import path from 'node:path';
import { smoothNormals, boxUV, bakeAO, buildBVH, fabricNormalMap } from './lib.mjs';

const [IN, OUT, ...ONLY] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

// medidas do catálogo (m); legTop = altura até onde vão os pés; frameX = moldura lateral de madeira
const CFG = {
  agata: { W: 0.72, D: 0.83, H: 0.90, legTop: 0.225, legMat: 'wood', frame: { outer: 0.335, inner: 0.322, arm: [0.565, 0.675], armX: 0.30 }, refine: { cut: 0.03, smooth: 1, woodIsland: 0.0008, fabricIsland: 0.0008 }, out: [{ id: 'agata-072' }] },
  berlim: { W: 1.90, D: 0.95, H: 0.85, legTop: 0.07, legMat: 'wood', armW: 0.15, out: [{ id: 'berlim-190' }, { id: 'berlim-140', W: 1.40 }] },
  florenza: { W: 2.10, D: 0.93, H: 0.86, legTop: 0.095, legMat: 'wood', armW: 0.15, out: [{ id: 'florenza-210' }, { id: 'florenza-170', W: 1.70 }] },
  doha: { W: 0.85, D: 0.85, H: 1.12, legTop: 0.035, legMat: 'plastic', out: [{ id: 'doha-085' }] },
  dalian: { W: 0.98, D: 0.91, H: 1.00, legTop: 0.025, legMat: 'plastic', out: [{ id: 'dalian-098' }] },
  ibiza: { W: 2.10, D: 0.95, H: 0.85, legTop: 0.045, legMat: 'wood', out: [{ id: 'ibiza-210-foto' }] },
  istambul: { W: 2.38, D: 0.85, H: 0.97, legTop: 0.068, legMat: 'wood', out: [{ id: 'istambul-238' }] },
  italia: { W: 0.72, D: 0.85, H: 0.82, legTop: 0.205, legMat: 'wood', thin: 0.07, thinIters: 4, refine: { cut: 0.03, smooth: 1, woodIsland: 0.0008, fabricIsland: 0.0008 }, out: [{ id: 'italia-072' }] },
  agataThin: { src: 'agata', W: 0.72, D: 0.83, H: 0.90, legTop: 0.225, legMat: 'wood', thin: 0.05, out: [{ id: 'agata-072-thin' }] },
  lazio: { W: 3.36, D: 1.45, H: 0.88, legTop: 0.148, legMat: 'plastic', out: [{ id: 'lazio-336' }] },
  mali: { W: 1.96, D: 0.90, H: 0.88, legTop: 0.105, legMat: 'wood', out: [{ id: 'mali-196' }] },
  melissa: { W: 0.76, D: 0.80, H: 0.78, legTop: 0.255, legMat: 'wood', thin: 0.045, thinIters: 3, sidePost: { x: 0.336, y: 0.47 }, refine: { cut: 0.03, smooth: 1, woodIsland: 0.0008, fabricIsland: 0.0008 }, out: [{ id: 'melissa-076' }] },
  paris: { W: 2.14, D: 0.85, H: 0.88, legTop: 0.15, legMat: 'wood', out: [{ id: 'paris-214' }] },
  parma: { W: 3.20, D: 1.00, H: 0.98, legTop: 0.055, legMat: 'wood', out: [{ id: 'parma-320-foto' }] },
  perola: { W: 0.95, D: 0.75, H: 0.86, legTop: 0.149, legMat: 'wood', refine: { smooth: 1, woodIsland: 0.0004, fabricIsland: 0.0004 }, out: [{ id: 'perola-095' }] },
  'puff-belle': { W: 0.90, D: 0.50, H: 0.45, legTop: 0.145, legMat: 'wood', thin: 0.045, thinIters: 3, posts: { x: [0.29, 0.342], z: 0.229, y: 0.34 }, refine: { smooth: 2, woodIsland: 0.0006, fabricIsland: 0.0006 }, out: [{ id: 'puff-belle-090' }] },
  roma: { W: 2.18, D: 0.93, H: 0.90, legTop: 0.115, legMat: 'wood', sideFrameX: 1.058, out: [{ id: 'roma-218' }] },
  rubi: { W: 0.66, D: 0.70, H: 0.82, legTop: 0.312, legMat: 'wood', refine: { smooth: 1, woodIsland: 0.0004, fabricIsland: 0.0004 }, out: [{ id: 'rubi-066' }] },
  safira: { W: 0.74, D: 0.75, H: 0.85, legTop: 0.27, legMat: 'wood', thin: 0.05, thinIters: 3, sideFrameX: 0.337, refine: { cut: 0.03, smooth: 1, woodIsland: 0.0008, fabricIsland: 0.0008 }, out: [{ id: 'safira-074' }] },
  tokio: { W: 3.10, D: 1.43, H: 0.88, legTop: 0.095, legMat: 'plastic', out: [{ id: 'tokio-310' }] },
  topazio: { W: 0.72, D: 0.80, H: 0.90, legTop: 0.25, legMat: 'wood', thin: 0.05, thinIters: 3, sideFrameX: 0.337, refine: { cut: 0.03, smooth: 1, woodIsland: 0.0008, fabricIsland: 0.0008 }, out: [{ id: 'topazio-072' }] },
  valencia: { W: 2.50, D: 1.00, H: 1.05, legTop: 0.045, legMat: 'wood', out: [{ id: 'valencia-250-foto' }] },
  versalhes: { W: 1.82, D: 0.90, H: 0.95, legTop: 0.065, legMat: 'wood', out: [{ id: 'versalhes-182-foto' }] },
  // versões derivadas do 3D de outra versão do mesmo modelo: `from` = medidas da origem, `ops` nas coordenadas da origem
  parma2: { src: 'parma', from: { W: 3.20, D: 1.00, H: 0.98 }, ops: [['cut', -0.43, 0.43]], W: 2.30, D: 1.00, H: 0.98, legTop: 0.055, legMat: 'wood', out: [{ id: 'parma-230-foto' }] },
  lazio1c: { src: 'lazio', from: { W: 3.36, D: 1.45, H: 0.88 }, ops: [['cut', -0.47, 0.53]], W: 2.36, D: 1.45, H: 0.88, legTop: 0.148, legMat: 'plastic', out: [{ id: 'lazio-236' }] },
  tokio1c: { src: 'tokio', from: { W: 3.10, D: 1.43, H: 0.88 }, ops: [['cut', -0.44, 0.44]], W: 2.20, D: 1.43, H: 0.88, legTop: 0.095, legMat: 'plastic', out: [{ id: 'tokio-220-chaise' }] },
  tokio2: { src: 'tokio', from: { W: 3.10, D: 1.43, H: 0.88 }, ops: [['mirror', 0.44]], W: 2.20, D: 0.93, H: 0.88, legTop: 0.095, legMat: 'plastic', out: [{ id: 'tokio-220' }] },
  tokioP: { src: 'tokio', from: { W: 3.10, D: 1.43, H: 0.88 }, ops: [['mirror', 1.025]], W: 1.05, D: 0.93, H: 0.88, legTop: 0.095, legMat: 'plastic', out: [{ id: 'tokio-poltrona-105' }] },
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
await MeshoptSimplifier.ready;
const normalJpg = await fabricNormalMap(path.join(OUT, '_normal.jpg'));
const floor = (() => { const g = new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2); return { pos: Float32Array.from(g.attributes.position.array), nrm: Float32Array.from(g.attributes.normal.array), idx: Uint32Array.from(g.index.array) }; })();

async function loadMesh(file, targetTris) {
  const doc = await io.read(file);
  for (const e of doc.getRoot().listExtensionsUsed()) e.dispose();
  const prim0 = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const tris = prim0.getIndices().getCount() / 3;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, targetTris / tris), error: 0.0008 }));
  const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  return { pos: Float32Array.from(p.getAttribute('POSITION').getArray()), idx: Uint32Array.from(p.getIndices().getArray()) };
}

function fit(src, c, W) {
  // centraliza em X/Z, apoia no chão e escala para W x H x D do catálogo
  const pos = src.pos, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[i + a]); mx[a] = Math.max(mx[a], pos[i + a]); }
  const s = [c.W / (mx[0] - mn[0]), c.H / (mx[1] - mn[1]), c.D / (mx[2] - mn[2])];
  const out = new Float32Array(pos.length);
  const half = c.W / 2, inner = c.armW ? half - c.armW - 0.03 : 0, inner2 = c.armW ? inner - (c.W - W) / 2 : 0;
  for (let i = 0; i < pos.length; i += 3) {
    let x = (pos[i] - (mn[0] + mx[0]) / 2) * s[0];
    if (W !== c.W) { // estreita só o meio: braços e pés não deformam
      const ax = Math.abs(x);
      x = ax <= inner ? x * (inner2 / inner) : Math.sign(x) * (ax - inner + inner2);
    }
    out[i] = x; out[i + 1] = (pos[i + 1] - mn[1]) * s[1]; out[i + 2] = (pos[i + 2] - (mn[2] + mx[2]) / 2) * s[2];
  }
  return out;
}


// ---------- derivar versões: tirar um módulo (corte entre duas emendas) ou espelhar uma metade ----------
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
// tira o trecho entre x0 e x1 (um módulo): corta as duas partes, fecha cada corte com tampa e junta
function cutSlab(pos, idx, x0, x1) {
  const A = clipCap(pos, idx, x0, true), B = clipCap(pos, idx, x1, false), nA = A.pos.length / 3;
  const P = new Float32Array(A.pos.length + B.pos.length); P.set(A.pos, 0);
  for (let i = 0; i < B.pos.length; i += 3) { P[A.pos.length + i] = B.pos[i] - (x1 - x0); P[A.pos.length + i + 1] = B.pos[i + 1]; P[A.pos.length + i + 2] = B.pos[i + 2]; }
  const I = new Uint32Array(A.idx.length + B.idx.length); I.set(A.idx, 0);
  for (let t = 0; t < B.idx.length; t++) I[A.idx.length + t] = B.idx[t] + nA;
  return { pos: P, idx: I };
}
function mirrorAt(pos, idx, xm) {
  // mantém o lado x >= xm e espelha
  const a = Float32Array.from(pos), keep = [];
  for (let i = 0; i < a.length; i += 3) if (a[i] < xm) a[i] = xm;
  for (let t = 0; t < idx.length; t += 3) if (!(pos[idx[t] * 3] < xm && pos[idx[t + 1] * 3] < xm && pos[idx[t + 2] * 3] < xm)) keep.push(idx[t], idx[t + 1], idx[t + 2]);
  const h = compact(a, Uint32Array.from(keep)), n = h.pos.length / 3;
  const p2 = new Float32Array(h.pos.length * 2), i2 = new Uint32Array(h.idx.length * 2);
  p2.set(h.pos, 0);
  for (let i = 0; i < h.pos.length; i += 3) { p2[h.pos.length + i] = 2 * xm - h.pos[i]; p2[h.pos.length + i + 1] = h.pos[i + 1]; p2[h.pos.length + i + 2] = h.pos[i + 2]; }
  i2.set(h.idx, 0);
  for (let t = 0; t < h.idx.length; t += 3) { i2[h.idx.length + t] = h.idx[t] + n; i2[h.idx.length + t + 1] = h.idx[t + 2] + n; i2[h.idx.length + t + 2] = h.idx[t + 1] + n; }
  return { pos: p2, idx: i2 };
}

// espessura local (raios para dentro da peça): moldura, ripas e pernas são finas; almofadas são grossas
function thickness(part) {
  const bvh = buildBVH([part]);
  const n = part.pos.length / 3, out = new Float32Array(n);
  const ray = new THREE.Ray(), nv = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  const cone = [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]], ds = [];
  for (let i = 0; i < n; i++) {
    nv.fromArray(part.nrm, i * 3);
    t1.set(Math.abs(nv.x) < 0.9 ? 1 : 0, Math.abs(nv.x) < 0.9 ? 0 : 1, 0).cross(nv).normalize(); t2.crossVectors(nv, t1);
    ds.length = 0;
    for (const [a, b] of cone) {
      ray.origin.fromArray(part.pos, i * 3).addScaledVector(nv, -0.002);
      ray.direction.set(0, 0, 0).addScaledVector(nv, -1).addScaledVector(t1, a).addScaledVector(t2, b).normalize();
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 0.4);
      ds.push(hit ? hit.distance : 0.4);
    }
    ds.sort((x, y) => x - y); out[i] = ds[2];
  }
  return out;
}
function smoothLabels(lbl, idx, iters = 2) {
  const n = lbl.length, nb = Array.from({ length: n }, () => []);
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = idx[t + k], b = idx[t + (k + 1) % 3]; nb[a].push(b); nb[b].push(a); }
  for (let it = 0; it < iters; it++) {
    const nx = lbl.slice();
    for (let i = 0; i < n; i++) { if (!nb[i].length) continue; let c1 = 0; for (const j of nb[i]) c1 += lbl[j]; nx[i] = c1 * 2 > nb[i].length ? 1 : c1 * 2 < nb[i].length ? 0 : lbl[i]; }
    lbl.set(nx);
  }
  return lbl;
}

function classify(pos, idx, c, W, part) {
  // 0 tecido, 1 madeira, 2 plástico (pelo centro de cada triângulo)
  const legCls = c.legMat === 'wood' ? 1 : 2, out = [[], [], []];
  // moldura lateral (Ágata): mapa (altura, profundidade) das pernas tirado das faces externas da moldura
  let mask = null;
  const f = c.frame, cell = 0.01, key = (y, z) => Math.round(y / cell) + ',' + Math.round(z / cell);
  if (f) {
    mask = new Set();
    for (let i = 0; i < pos.length; i += 3) {
      const ax = Math.abs(pos[i]), y = pos[i + 1], z = pos[i + 2];
      if (ax > f.outer && y > c.legTop && y < f.arm[0])
        for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) mask.add(key(y + dy * cell, z + dz * cell));
    }
  }
  let thinV = null;
  if (c.thin) {
    const th = thickness(part), lbl = new Uint8Array(th.length);
    for (let i = 0; i < th.length; i++) lbl[i] = th[i] < c.thin ? 1 : 0;
    thinV = smoothLabels(lbl, idx, c.thinIters || 2);
  }
  const lab = new Uint8Array(idx.length / 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, d = idx[t + 2] * 3;
    const cx = Math.abs((pos[a] + pos[b] + pos[d]) / 3), cy = (pos[a + 1] + pos[b + 1] + pos[d + 1]) / 3, cz = (pos[a + 2] + pos[b + 2] + pos[d + 2]) / 3;
    let k = 0;
    if (cy < c.legTop) k = legCls;
    // postes de madeira que sobem pela lateral do estofado (Puff Belle): ficam para fora da face
    else if (c.posts && cx > c.posts.x[0] && cx < c.posts.x[1] && Math.abs(cz) > c.posts.z && cy < c.posts.y) k = legCls;
    else if (thinV && thinV[idx[t]] + thinV[idx[t + 1]] + thinV[idx[t + 2]] >= 2) k = 1;
    else if (c.sideFrameX && cx > c.sideFrameX) k = 1; // moldura de madeira na lateral do braço
    else if (c.sidePost && cx > c.sidePost.x && cy < c.sidePost.y) k = 1; // pés que sobem ao lado do assento até o braço (Melissa)
    else if (f && cy > f.arm[0] && cy < f.arm[1] && cx > f.armX) k = 1;
    else if (f && cx > f.inner && mask.has(key(cy, cz))) k = 1;
    else if (f && f.post && cy >= f.arm[1] && cx > f.post) k = 1;
    else if (c.rear && cz < c.rear.z && cy > c.rear.y[0] && cy < c.rear.y[1]) {
      // ripas de madeira nas costas: faces voltadas para trás
      const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[d] - pos[a], pos[d + 1] - pos[a + 1], pos[d + 2] - pos[a + 2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
      if (nz / (Math.hypot(nx, ny, nz) || 1) < c.rear.nz) k = 1;
    }
    lab[t / 3] = k;
  }
  if (c.refine) refineLabels(pos, idx, lab, c, legCls);
  for (let t = 0; t < lab.length; t++) out[lab[t]].push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
  return out;
}

// Corta os triângulos que atravessam o plano y = y0 (a linha do topo do pé fica reta).
function splitAtY(pos, idx, y0) {
  const P = Array.from(pos), I = [], cache = new Map(), N = pos.length / 3;
  const side = (i) => (P[i * 3 + 1] >= y0 ? 1 : 0);
  const mid = (a, b) => {
    const ya = P[a * 3 + 1], yb = P[b * 3 + 1], s = (y0 - ya) / (yb - ya);
    if (s < 1e-4) return a;
    if (s > 1 - 1e-4) return b;
    const key = a < b ? a * N + b : b * N + a;
    let m = cache.get(key);
    if (m === undefined) { m = P.length / 3; P.push(P[a * 3] + s * (P[b * 3] - P[a * 3]), y0, P[a * 3 + 2] + s * (P[b * 3 + 2] - P[a * 3 + 2])); cache.set(key, m); }
    return m;
  };
  const tri = (a, b, d) => { if (a !== b && b !== d && a !== d) I.push(a, b, d); };
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]], s = v.map(side), n1 = s[0] + s[1] + s[2];
    if (n1 === 0 || n1 === 3) { I.push(v[0], v[1], v[2]); continue; }
    const k = s[0] !== s[1] && s[0] !== s[2] ? 0 : s[1] !== s[0] && s[1] !== s[2] ? 1 : 2;
    const a = v[k], b = v[(k + 1) % 3], d = v[(k + 2) % 3], mab = mid(a, b), mad = mid(a, d);
    tri(a, mab, mad); tri(mab, b, d); tri(mab, d, mad);
  }
  return { pos: Float32Array.from(P), idx: Uint32Array.from(I) };
}

// Limpa a separação madeira/tecido: pé subindo até o corpo, bordas lisas e sem ilhas soltas.
function refineLabels(pos, idx, lab, c, woodCls) {
  const R = c.refine, T = lab.length, N = pos.length / 3;
  const cen = new Float32Array(T * 3), nrm = new Float32Array(T * 3), area = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, d = idx[t * 3 + 2] * 3;
    for (let j = 0; j < 3; j++) cen[t * 3 + j] = (pos[a + j] + pos[b + j] + pos[d + j]) / 3;
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[d] - pos[a], pos[d + 1] - pos[a + 1], pos[d + 2] - pos[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], L = Math.hypot(...n) || 1;
    for (let j = 0; j < 3; j++) nrm[t * 3 + j] = n[j] / L;
    area[t] = L / 2;
  }
  // vizinhos por aresta (e o comprimento da aresta em comum)
  const edges = new Map(), adj = Array.from({ length: T }, () => []), pairs = [];
  for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) {
    const u = idx[t * 3 + k], v = idx[t * 3 + (k + 1) % 3], key = u < v ? u * N + v : v * N + u;
    const o = edges.get(key);
    if (o === undefined) edges.set(key, t);
    else { adj[t].push(o); adj[o].push(t); pairs.push(t, o, Math.hypot(pos[u * 3] - pos[v * 3], pos[u * 3 + 1] - pos[v * 3 + 1], pos[u * 3 + 2] - pos[v * 3 + 2])); }
  }
  const isW = (l) => l === 1; // suavização e ilhas só entre tecido (0) e madeira (1); plástico (2) fica como está
  // 0) corte mínimo: a fronteira madeira/tecido vai para os vincos (onde a superfície dobra) e perde os serrilhados.
  //    Trocar o material custa a área; manter uma fronteira custa o comprimento dela, caro em superfície lisa.
  if (R.cut) {
    const S = T, K = T + 1, V = T + 2, cap = [], to = [], head = new Int32Array(V).fill(-1), next = [];
    const arc = (a, b, c1, c2) => { to.push(b); cap.push(c1); next.push(head[a]); head[a] = to.length - 1; to.push(a); cap.push(c2); next.push(head[b]); head[b] = to.length - 1; };
    const BIG = 1e9, th0 = (R.angle || 25) * Math.PI / 180;
    for (let t = 0; t < T; t++) {
      if (lab[t] === 2) continue;
      const fixed = cen[t * 3 + 1] < c.legTop;
      if (lab[t] === 0) arc(S, t, area[t], 0); // tecido: virar madeira custa a área
      else arc(t, K, fixed ? BIG : area[t], 0); // madeira: virar tecido custa a área (pé: proibido)
    }
    for (let i = 0; i < pairs.length; i += 3) {
      const a = pairs[i], b = pairs[i + 1];
      if (lab[a] === 2 || lab[b] === 2) continue;
      const cos = nrm[a * 3] * nrm[b * 3] + nrm[a * 3 + 1] * nrm[b * 3 + 1] + nrm[a * 3 + 2] * nrm[b * 3 + 2];
      const ang = Math.acos(Math.max(-1, Math.min(1, cos))), w = R.cut * pairs[i + 2] * Math.max(0.02, Math.exp(-((ang / th0) ** 2)));
      arc(a, b, w, w);
    }
    const capA = Float64Array.from(cap), toA = Int32Array.from(to), nextA = Int32Array.from(next), level = new Int32Array(V), it = new Int32Array(V), q = new Int32Array(V);
    const bfs = () => {
      level.fill(-1); level[S] = 0; let qh = 0, qt = 0; q[qt++] = S;
      while (qh < qt) { const x = q[qh++]; for (let e = head[x]; e >= 0; e = nextA[e]) if (capA[e] > 1e-15 && level[toA[e]] < 0) { level[toA[e]] = level[x] + 1; q[qt++] = toA[e]; } }
      return level[K] >= 0;
    };
    const dfs = (x, f) => {
      if (x === K) return f;
      for (; it[x] >= 0; it[x] = nextA[it[x]]) {
        const e = it[x], y = toA[e];
        if (capA[e] > 1e-15 && level[y] === level[x] + 1) {
          const d = dfs(y, Math.min(f, capA[e]));
          if (d > 0) { capA[e] -= d; capA[e ^ 1] += d; return d; }
        }
      }
      return 0;
    };
    while (bfs()) { it.set(head); while (dfs(S, Infinity) > 0); }
    // quem ainda alcança a fonte fica tecido; o resto, madeira
    bfs();
    for (let t = 0; t < T; t++) if (lab[t] !== 2) lab[t] = level[t] >= 0 ? 0 : 1;
  }
  // 1) o pé sobe até encostar no corpo: faces laterais (normal quase horizontal) dentro da "pegada" do pé
  if (R.legUp) {
    const cell = 0.01, foot = new Set(), key = (x, z) => Math.round(x / cell) + ',' + Math.round(z / cell);
    for (let i = 0; i < N; i++) {
      const y = pos[i * 3 + 1];
      if (y > c.legTop - 0.03 && y < c.legTop) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) foot.add(key(pos[i * 3] + dx * cell, pos[i * 3 + 2] + dz * cell));
    }
    for (let t = 0; t < T; t++) {
      const y = cen[t * 3 + 1];
      if (y >= c.legTop && y < c.legTop + R.legUp && Math.abs(nrm[t * 3 + 1]) < 0.75 && foot.has(key(cen[t * 3], cen[t * 3 + 2]))) lab[t] = woodCls;
    }
  }
  // 2) bordas: cada face fica com o material da maioria dos vizinhos (só entre tecido e madeira)
  for (let it = 0; it < (R.smooth || 0); it++) {
    const nx = lab.slice();
    for (let t = 0; t < T; t++) {
      if (lab[t] === 2) continue;
      let w = 0, f = 0;
      for (const o of adj[t]) { if (isW(lab[o])) w++; else if (lab[o] === 0) f++; }
      if (isW(lab[t]) && f >= 2) nx[t] = 0; else if (lab[t] === 0 && w >= 2) nx[t] = 1;
    }
    lab.set(nx);
  }
  // 3) ilhas pequenas cercadas pelo outro material trocam de material
  const comp = new Int32Array(T).fill(-1);
  for (let s = 0; s < T; s++) {
    if (comp[s] >= 0 || lab[s] === 2) continue;
    const L = lab[s], stack = [s], members = [];
    let A = 0, touchesOther = false, touchesSame3 = false;
    comp[s] = s;
    while (stack.length) {
      const t = stack.pop(); members.push(t); A += area[t];
      for (const o of adj[t]) {
        if (lab[o] === L) { if (comp[o] < 0) { comp[o] = s; stack.push(o); } }
        else if (lab[o] === 2) touchesSame3 = true; else touchesOther = true;
      }
    }
    const limit = isW(L) ? R.woodIsland || 0 : R.fabricIsland || 0;
    if (A < limit && touchesOther && !touchesSame3) for (const t of members) lab[t] = isW(L) ? 0 : 1;
  }
}

async function writeGLB(part, groups, file) {
  const doc = new Document(), buffer = doc.createBuffer();
  const sheenExt = doc.createExtension(KHRMaterialsSheen), specExt = doc.createExtension(KHRMaterialsSpecular);
  const tex = doc.createTexture('tecido_normal').setImage(normalJpg).setMimeType('image/jpeg');
  const fabric = doc.createMaterial('Tecido').setBaseColorFactor([0.30, 0.31, 0.32, 1]).setRoughnessFactor(0.92).setMetallicFactor(0).setNormalTexture(tex).setNormalScale(0.55);
  fabric.setExtension('KHR_materials_sheen', sheenExt.createSheen().setSheenColorFactor([0.5, 0.5, 0.52]).setSheenRoughnessFactor(0.55));
  fabric.setExtension('KHR_materials_specular', specExt.createSpecular().setSpecularFactor(0.25));
  const mats = [fabric,
    doc.createMaterial('Madeira').setBaseColorFactor([0.21, 0.08, 0.03, 1]).setRoughnessFactor(0.42).setMetallicFactor(0),
    doc.createMaterial('Pes').setBaseColorFactor([0.025, 0.022, 0.02, 1]).setRoughnessFactor(0.45).setMetallicFactor(0)];
  const n = part.pos.length / 3, color = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const v = Math.round(part.ao[i] * 255); color.set([v, v, v, 255], i * 4); }
  const acc = {
    POSITION: doc.createAccessor().setType('VEC3').setArray(part.pos).setBuffer(buffer),
    NORMAL: doc.createAccessor().setType('VEC3').setArray(part.nrm).setBuffer(buffer),
    COLOR_0: doc.createAccessor().setType('VEC4').setArray(color).setNormalized(true).setBuffer(buffer),
    TEXCOORD_0: doc.createAccessor().setType('VEC2').setArray(boxUV(part)).setBuffer(buffer),
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
  doc.getRoot().getAsset().generator = 'Provador 3D Artflex (forma por IA, medidas do catálogo)';
  await new NodeIO().registerExtensions([KHRMaterialsSheen, KHRMaterialsSpecular]).write(file, doc);
}

for (const [name, c] of Object.entries(CFG)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  const t0 = Date.now();
  let src = await loadMesh(path.join(IN, (c.src || name) + '.glb'), 70000);
  if (c.ops) {
    let m = { pos: fit(src, c.from, c.from.W), idx: src.idx };
    for (const op of c.ops) m = op[0] === 'cut' ? cutSlab(m.pos, m.idx, op[1], op[2]) : mirrorAt(m.pos, m.idx, op[1]);
    src = m;
  }
  for (const o of c.out) {
    const W = o.W || c.W;
    let pos = fit(src, c, W), idx = src.idx;
    // corta a malha no plano do topo do pé: a linha madeira/tecido fica reta
    if (c.refine) ({ pos, idx } = splitAtY(pos, idx, c.legTop));
    const part = { pos, idx, nrm: smoothNormals(pos, idx) };
    const groups = classify(pos, idx, c, W, part);
    part.ao = bakeAO(part, buildBVH([part, floor]), 0.25);
    await writeGLB(part, groups, path.join(OUT, o.id + '.glb'));
    const b = new THREE.Box3(), v = new THREE.Vector3();
    for (let i = 0; i < pos.length; i += 3) b.expandByPoint(v.fromArray(pos, i));
    const r = (x) => Math.round(x * 100) / 100;
    console.log(o.id, 'medido', r(b.max.x - b.min.x), 'x', r(b.max.z - b.min.z), 'x', r(b.max.y - b.min.y), '| tris', idx.length / 3, '| tecido/madeira/plástico', groups.map((g) => g.length / 3).join('/'), '|', (fs.statSync(path.join(OUT, o.id + '.glb')).size / 1024).toFixed(0) + 'KB', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
}
fs.rmSync(path.join(OUT, '_normal.jpg'));
