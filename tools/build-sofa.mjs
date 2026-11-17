// Gera um sofá retrátil e reclinável paramétrico (um GLB por largura).
// Uso: node build-sofa.mjs <pasta-saida> [larguras...]
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsSheen, KHRMaterialsSpecular } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'out';
const SIZES = process.argv.length > 3 ? process.argv.slice(3).map(Number) : [2.0, 2.3, 2.5, 2.7, 2.9];
fs.mkdirSync(OUT, { recursive: true });

// ---------------- medidas base (metros) ----------------
const P = {
  armW: 0.20, armH0: 0.06, armH1: 0.62, zBack: -0.50, zFront: 0.48,
  seatY0: 0.10, seatY1: 0.47, seatZ0: -0.49, seatZ1: 0.47,
  gap: 0.008,
  drawerY0: 0.11, drawerY1: 0.41, drawerDepth: 0.50, drawerTravel: 0.48,
  backPivotY: 0.44, backPivotZ: -0.48, backH: 0.52, backT: 0.32,
  backAngleClosed: -10, backAngleOpen: -24,
  uvTiles: 4.0, // repetições da textura por metro
};

// ---------------- geometria ----------------
function grid(h, r, k, m) {
  const a = [];
  for (let i = 0; i <= k; i++) a.push(-h + r * (i / k));
  for (let i = 1; i < m; i++) a.push(-h + r + (2 * h - 2 * r) * (i / m));
  for (let i = k; i >= 0; i--) a.push(h - r * (i / k));
  return a;
}

// Caixa arredondada com "estufamento" de almofada.
// bulge: [[-x,+x],[-y,+y],[-z,+z]] em metros
function roundedBox({ size, r, k = 4, density = 0.07, bulge = [[0, 0], [0, 0], [0, 0]], exp = 2 }) {
  const H = size.map((s) => s / 2);
  const G = H.map((hh) => grid(hh, r, k, Math.max(1, Math.ceil((2 * hh - 2 * r) / density))));
  const pos = [], idx = [];
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const u = (a + 1) % 3, v = (a + 2) % 3;
    const Gu = G[u], Gv = G[v], base = pos.length / 3, nu = Gu.length;
    for (let j = 0; j < Gv.length; j++) for (let i = 0; i < nu; i++) {
      const p = [0, 0, 0]; p[a] = s * H[a]; p[u] = Gu[i]; p[v] = Gv[j]; pos.push(...p);
    }
    for (let j = 0; j < Gv.length - 1; j++) for (let i = 0; i < nu - 1; i++) {
      const A = base + j * nu + i, B = A + 1, C = A + nu, D = C + 1;
      if (s > 0) idx.push(A, B, D, A, D, C); else idx.push(A, D, B, A, C, D);
    }
  }
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const p = [pos[i], pos[i + 1], pos[i + 2]];
    const q = p.map((x, ax) => x / H[ax]);
    const inner = p.map((x, ax) => Math.max(-(H[ax] - r), Math.min(H[ax] - r, x)));
    const d = [p[0] - inner[0], p[1] - inner[1], p[2] - inner[2]];
    const L = Math.hypot(...d);
    const rp = L > 1e-9 ? inner.map((c, ax) => c + (d[ax] / L) * r) : p.slice();
    for (let ax = 0; ax < 3; ax++) {
      const b = q[ax] > 0 ? bulge[ax][1] : bulge[ax][0];
      if (!b) continue;
      let f = 1;
      for (let o = 0; o < 3; o++) if (o !== ax) f *= 1 - Math.pow(Math.min(1, Math.abs(q[o])), exp);
      rp[ax] += b * q[ax] * Math.max(0, f);
    }
    out.set(rp, i);
  }
  const part = { pos: out, idx: Uint32Array.from(idx) };
  part.nrm = smoothNormals(part.pos, part.idx);
  return part;
}

function smoothNormals(pos, idx) {
  const n = pos.length / 3, map = new Map(), id = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`;
    let g = map.get(k); if (g === undefined) { g = map.size; map.set(k, g); } id[i] = g;
  }
  const acc = new Float64Array(map.size * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    for (const v of [idx[t], idx[t + 1], idx[t + 2]]) { const g = id[v] * 3; acc[g] += cx; acc[g + 1] += cy; acc[g + 2] += cz; }
  }
  const nrm = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const g = id[i] * 3, L = Math.hypot(acc[g], acc[g + 1], acc[g + 2]) || 1;
    nrm[i * 3] = acc[g] / L; nrm[i * 3 + 1] = acc[g + 1] / L; nrm[i * 3 + 2] = acc[g + 2] / L;
  }
  return nrm;
}

function cylinderPart(rTop, rBot, h) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 20, 1);
  return { pos: Float32Array.from(g.attributes.position.array), nrm: Float32Array.from(g.attributes.normal.array), idx: Uint32Array.from(g.index.array) };
}


// Vivo (piping) de costura: tubo fino ao longo do contorno de uma face arredondada.
// Constrói no plano XZ (y=0) e depois a matriz posiciona/rotaciona.
function pipingLoop(hx, hz, rc, tubeR = 0.0034, radial = 6, step = 0.08) {
  const pts = [];
  const corners = [[hx - rc, hz - rc, 0], [-(hx - rc), hz - rc, Math.PI / 2], [-(hx - rc), -(hz - rc), Math.PI], [hx - rc, -(hz - rc), 1.5 * Math.PI]];
  for (let c = 0; c < 4; c++) {
    const [cx, cz, a0] = corners[c];
    for (let i = 0; i <= 6; i++) { const a = a0 + (Math.PI / 2) * (i / 6); pts.push([cx + rc * Math.cos(a), cz + rc * Math.sin(a)]); }
    const [nx, nz, na] = corners[(c + 1) % 4];
    const ex = [cx + rc * Math.cos(a0 + Math.PI / 2), cz + rc * Math.sin(a0 + Math.PI / 2)];
    const sx = [nx + rc * Math.cos(na), nz + rc * Math.sin(na)];
    const L = Math.hypot(sx[0] - ex[0], sx[1] - ex[1]), k = Math.max(1, Math.round(L / step));
    for (let i = 1; i < k; i++) pts.push([ex[0] + (sx[0] - ex[0]) * i / k, ex[1] + (sx[1] - ex[1]) * i / k]);
  }
  const N = pts.length, pos = [], nrm = [], idx = [];
  for (let i = 0; i < N; i++) {
    const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
    const sx = tz, sz = -tx; // lado (para fora no plano)
    for (let j = 0; j < radial; j++) {
      const ang = (2 * Math.PI * j) / radial, cs = Math.cos(ang), sn = Math.sin(ang);
      const n = [cs * sx, sn, cs * sz];
      nrm.push(...n); pos.push(pts[i][0] + n[0] * tubeR, n[1] * tubeR, pts[i][1] + n[2] * tubeR);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = ((i + 1) % N) * radial + j, d = ((i + 1) % N) * radial + ((j + 1) % radial);
    idx.push(a, c, b, b, c, d);
  }
  return { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), idx: Uint32Array.from(idx) };
}
// contorno a 45° na aresta arredondada de uma caixa (face +Y), em coordenadas locais da caixa
function topPiping(size, r) {
  const s45 = Math.SQRT1_2, [w, h, d] = size;
  const loop = pipingLoop(w / 2 - r + r * s45, d / 2 - r + r * s45, r * s45);
  const out = transformPart(loop, T(0, h / 2 - r + r * s45, 0));
  out.aoMin = 0.78;
  return out;
}

function transformPart(part, m4) {
  const nm = new THREE.Matrix3().getNormalMatrix(m4), v = new THREE.Vector3();
  const pos = new Float32Array(part.pos.length), nrm = new Float32Array(part.nrm.length);
  for (let i = 0; i < pos.length; i += 3) {
    v.fromArray(part.pos, i).applyMatrix4(m4).toArray(pos, i);
    v.fromArray(part.nrm, i).applyMatrix3(nm).normalize().toArray(nrm, i);
  }
  return { pos, nrm, idx: part.idx, aoMin: part.aoMin, aoMinArr: part.aoMinArr };
}
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

function mergeParts(parts) {
  let nv = 0, ni = 0; for (const p of parts) { nv += p.pos.length; ni += p.idx.length; }
  const pos = new Float32Array(nv), nrm = new Float32Array(nv), idx = new Uint32Array(ni), aoMin = new Float32Array(nv / 3);
  let ov = 0, oi = 0;
  for (const p of parts) {
    pos.set(p.pos, ov); nrm.set(p.nrm, ov);
    if (p.aoMinArr) aoMin.set(p.aoMinArr, ov / 3); else aoMin.fill(p.aoMin || 0, ov / 3, (ov + p.pos.length) / 3);
    for (let i = 0; i < p.idx.length; i++) idx[oi + i] = p.idx[i] + ov / 3;
    ov += p.pos.length; oi += p.idx.length;
  }
  return { pos, nrm, idx, aoMinArr: aoMin };
}

function boxUV(part) {
  const n = part.pos.length / 3, uv = new Float32Array(n * 2), t = P.uvTiles;
  for (let i = 0; i < n; i++) {
    const x = part.pos[i * 3], y = part.pos[i * 3 + 1], z = part.pos[i * 3 + 2];
    const ax = Math.abs(part.nrm[i * 3]), ay = Math.abs(part.nrm[i * 3 + 1]), az = Math.abs(part.nrm[i * 3 + 2]);
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u * t; uv[i * 2 + 1] = v * t;
  }
  return uv;
}

// ---------------- oclusão de ambiente por vértice ----------------
const SAMPLES = (() => {
  const s = [], N = 72;
  for (let i = 0; i < N; i++) {
    const u1 = (i + 0.5) / N, u2 = (i * 0.618033988749895) % 1;
    const r = Math.sqrt(u1), phi = 2 * Math.PI * u2;
    s.push([r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u1)]);
  }
  return s;
})();

function bakeAO(worldPart, bvh, maxD = 0.30) {
  const n = worldPart.pos.length / 3, ao = new Float32Array(n);
  const ray = new THREE.Ray(), nv = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    nv.fromArray(worldPart.nrm, i * 3);
    t1.set(Math.abs(nv.x) < 0.9 ? 1 : 0, Math.abs(nv.x) < 0.9 ? 0 : 1, 0).cross(nv).normalize();
    t2.crossVectors(nv, t1);
    let occ = 0;
    for (const [a, b, c] of SAMPLES) {
      ray.origin.fromArray(worldPart.pos, i * 3).addScaledVector(nv, 0.0015);
      ray.direction.set(0, 0, 0).addScaledVector(t1, a).addScaledVector(t2, b).addScaledVector(nv, c).normalize();
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, maxD);
      if (hit) occ += 1 - Math.pow(hit.distance / maxD, 0.7);
    }
    const v = 1 - occ / SAMPLES.length;
    ao[i] = Math.max(worldPart.aoMinArr ? worldPart.aoMinArr[i] : 0, Math.min(1, 0.30 + 0.78 * Math.pow(Math.max(0, v), 1.15)));
  }
  return ao;
}

function buildBVH(parts) {
  const m = mergeParts(parts);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
  g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  return new MeshBVH(g);
}

// ---------------- textura de tecido (normal map, repetível) ----------------
async function fabricNormalMap(file) {
  const S = 512;
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vnoise = (x, y, f, s) => {
    const X = Math.floor(x * f), Y = Math.floor(y * f), fx = x * f - X, fy = y * f - Y;
    const sm = (t) => t * t * (3 - 2 * t);
    const g = (i, j) => hash(((X + i) % f + f) % f, ((Y + j) % f + f) % f, s);
    const a = g(0, 0), b = g(1, 0), c = g(0, 1), d = g(1, 1);
    return a + (b - a) * sm(fx) + (c - a) * sm(fy) + (a - b - c + d) * sm(fx) * sm(fy);
  };
  const hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    let h = 0.55 * vnoise(u, v, 6, 1) + 0.30 * vnoise(u, v, 24, 2) + 0.22 * vnoise(u, v, 64, 3) + 0.30 * vnoise(u, v, 160, 4) + 0.25 * vnoise(u, v, 256, 5);
    // trama fina do tecido
    h += 0.10 * Math.sin(2 * Math.PI * u * 128) * Math.sin(2 * Math.PI * v * 128);
    hgt[y * S + x] = h;
  }
  const buf = Buffer.alloc(S * S * 3), str = 5.0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const H = (i, j) => hgt[((j + S) % S) * S + ((i + S) % S)];
    const dx = (H(x + 1, y) - H(x - 1, y)) * str, dy = (H(x, y + 1) - H(x, y - 1)) * str;
    const L = Math.hypot(dx, dy, 1), o = (y * S + x) * 3;
    buf[o] = Math.round((-dx / L * 0.5 + 0.5) * 255);
    buf[o + 1] = Math.round((dy / L * 0.5 + 0.5) * 255);
    buf[o + 2] = Math.round((1 / L * 0.5 + 0.5) * 255);
  }
  await sharp(buf, { raw: { width: S, height: S, channels: 3 } }).jpeg({ quality: 88 }).toFile(file);
  return fs.readFileSync(file);
}

// ---------------- montagem de um tamanho ----------------
function buildSofa(W) {
  const inner = W - 2 * P.armW;
  const n = Math.max(2, Math.round(inner / 0.72));
  const wm = inner / n;
  const fixed = [], drawers = [], backsLocal = [], feet = [];

  // braços
  const armH = P.armH1 - P.armH0, armD = P.zFront - P.zBack;
  for (const s of [-1, 1]) {
    const arm = roundedBox({ size: [P.armW, armH, armD], r: 0.065, density: 0.07,
      bulge: [[0.006, 0.006], [0, 0.012], [0.004, 0.008]], exp: 3 });
    const armM = T(s * (W / 2 - P.armW / 2 - 0.006), P.armH0 + armH / 2, (P.zFront + P.zBack) / 2);
    fixed.push(transformPart(arm, armM));
    // vivo no contorno lateral externo do braço (face ±X): gira o contorno de +Y para ±X
    const rotZ = new THREE.Matrix4().makeRotationZ(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    fixed.push(transformPart(topPiping([armH, P.armW, armD], 0.065), armM.clone().multiply(rotZ)));
  }
  // assentos fixos, gavetas retráteis e encostos reclináveis por módulo
  const seatH = P.seatY1 - P.seatY0, seatD = P.seatZ1 - P.seatZ0;
  const drH = P.drawerY1 - P.drawerY0;
  for (let i = 0; i < n; i++) {
    const cx = -inner / 2 + wm * (i + 0.5);
    const seat = roundedBox({ size: [wm - P.gap, seatH, seatD], r: 0.05, density: 0.07,
      bulge: [[0.004, 0.004], [0, 0.022], [0, 0.010]], exp: 4 });
    const seatM = T(cx, P.seatY0 + seatH / 2, (P.seatZ0 + P.seatZ1) / 2);
    fixed.push(transformPart(seat, seatM));
    fixed.push(transformPart(topPiping([wm - P.gap, seatH, seatD], 0.05), seatM));

    const dr = roundedBox({ size: [wm - P.gap - 0.012, drH, P.drawerDepth], r: 0.045, density: 0.07,
      bulge: [[0.003, 0.003], [0, 0.016], [0, 0.008]], exp: 4 });
    const drM = T(cx, P.drawerY0 + drH / 2, P.seatZ1 - 0.006 - P.drawerDepth / 2);
    drawers.push(transformPart(dr, drM));
    drawers.push(transformPart(topPiping([wm - P.gap - 0.012, drH, P.drawerDepth], 0.045), drM));

    const back = roundedBox({ size: [wm - P.gap, P.backH, P.backT], r: 0.075, density: 0.07,
      bulge: [[0.008, 0.008], [0.004, 0.014], [0.010, 0.038]], exp: 2 });
    const backM = T(cx, P.backH / 2, P.backT / 2);
    backsLocal.push(transformPart(back, backM));
    const rotX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    backsLocal.push(transformPart(topPiping([wm - P.gap, P.backT, P.backH], 0.075), backM.clone().multiply(rotX)));
  }
  // pés
  const footA = cylinderPart(0.022, 0.017, P.armH0);
  for (const s of [-1, 1]) for (const z of [P.zFront - 0.07, P.zBack + 0.07])
    feet.push(transformPart(footA, T(s * (W / 2 - 0.07), P.armH0 / 2, z)));
  const footB = cylinderPart(0.022, 0.017, P.seatY0);
  for (let i = 1; i < n; i++) for (const z of [P.seatZ1 - 0.12, P.seatZ0 + 0.10])
    feet.push(transformPart(footB, T(-inner / 2 + wm * i, P.seatY0 / 2, z)));

  const fixedM = mergeParts(fixed), drawersM = mergeParts(drawers), backsM = mergeParts(backsLocal), feetM = mergeParts(feet);

  // transformações dos nós
  const backPivot = T(0, P.backPivotY, P.backPivotZ);
  const rotM = (deg) => new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(deg));
  const backClosedWorld = transformPart(backsM, backPivot.clone().multiply(rotM(P.backAngleClosed)));
  const backOpenWorld = transformPart(backsM, backPivot.clone().multiply(rotM(P.backAngleOpen)));
  const drawersOpenWorld = transformPart(drawersM, T(0, 0, P.drawerTravel));

  // AO: cada peça no estado em que aparece
  const floor = (() => { const g = new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2); return { pos: Float32Array.from(g.attributes.position.array), nrm: Float32Array.from(g.attributes.normal.array), idx: Uint32Array.from(g.index.array) }; })();
  const bvhClosed = buildBVH([fixedM, backClosedWorld, feetM, floor]);
  const bvhOpen = buildBVH([fixedM, backOpenWorld, drawersOpenWorld, feetM, floor]);
  fixedM.ao = bakeAO(fixedM, bvhClosed);
  backsM.ao = bakeAO(backClosedWorld, bvhClosed);
  drawersM.ao = bakeAO(drawersOpenWorld, bvhOpen);
  feetM.ao = bakeAO(feetM, bvhClosed);

  // caixas (fechado/aberto)
  const bbox = (parts) => { const b = new THREE.Box3(); const v = new THREE.Vector3(); for (const p of parts) for (let i = 0; i < p.pos.length; i += 3) b.expandByPoint(v.fromArray(p.pos, i)); return b; };
  const closed = bbox([fixedM, backClosedWorld, feetM]);
  const open = bbox([fixedM, backOpenWorld, drawersOpenWorld, feetM]);
  return { W, n, fixedM, drawersM, backsM, feetM, closed, open };
}

// ---------------- exportação GLB ----------------
async function writeGLB(s, normalJpg, file) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const sheenExt = doc.createExtension(KHRMaterialsSheen);
  const specExt = doc.createExtension(KHRMaterialsSpecular);

  const tex = doc.createTexture('tecido_normal').setImage(normalJpg).setMimeType('image/jpeg');
  const fabric = doc.createMaterial('Tecido')
    .setBaseColorFactor([0.30, 0.31, 0.32, 1]).setRoughnessFactor(0.92).setMetallicFactor(0)
    .setNormalTexture(tex).setNormalScale(0.55);
  fabric.setExtension('KHR_materials_sheen', sheenExt.createSheen().setSheenColorFactor([0.55, 0.56, 0.58]).setSheenRoughnessFactor(0.55));
  fabric.setExtension('KHR_materials_specular', specExt.createSpecular().setSpecularFactor(0.25));
  const footMat = doc.createMaterial('Pes').setBaseColorFactor([0.025, 0.022, 0.02, 1]).setRoughnessFactor(0.45).setMetallicFactor(0);

  const mkPrim = (part, mat, withUV) => {
    const n = part.pos.length / 3;
    const color = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) { const a = Math.round(part.ao[i] * 255); color[i * 4] = a; color[i * 4 + 1] = a; color[i * 4 + 2] = a; color[i * 4 + 3] = 255; }
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(part.pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(part.nrm).setBuffer(buffer))
      .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(color).setNormalized(true).setBuffer(buffer))
      .setMaterial(mat);
    if (withUV) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(boxUV(part)).setBuffer(buffer));
    const ind = n < 65535 ? Uint16Array.from(part.idx) : part.idx;
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(ind).setBuffer(buffer));
    return prim;
  };

  const zc = (s.closed.min.z + s.closed.max.z) / 2;
  const root = doc.createNode('Sofa').setTranslation([0, 0, -zc]);
  const nFixed = doc.createNode('Estrutura').setMesh(doc.createMesh('Estrutura').addPrimitive(mkPrim(s.fixedM, fabric, true)));
  const nFeet = doc.createNode('Pes').setMesh(doc.createMesh('Pes').addPrimitive(mkPrim(s.feetM, footMat, false)));
  const nDrawers = doc.createNode('Retratil').setMesh(doc.createMesh('Retratil').addPrimitive(mkPrim(s.drawersM, fabric, true)));
  const q = (deg) => { const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(deg)); return [qq.x, qq.y, qq.z, qq.w]; };
  const nBacks = doc.createNode('Encostos').setTranslation([0, P.backPivotY, P.backPivotZ]).setRotation(q(P.backAngleClosed))
    .setMesh(doc.createMesh('Encostos').addPrimitive(mkPrim(s.backsM, fabric, true)));
  root.addChild(nFixed).addChild(nFeet).addChild(nDrawers).addChild(nBacks);
  doc.createScene('Cena').addChild(root);

  // animação "Abrir": retrátil desliza e encosto reclina
  const times = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 0.45, 1.2])).setBuffer(buffer);
  const trans = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 0, 0, P.drawerTravel * 0.62, 0, 0, P.drawerTravel])).setBuffer(buffer);
  const rTimes = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 0.4, 1.2])).setBuffer(buffer);
  const rot = doc.createAccessor().setType('VEC4').setArray(new Float32Array([...q(P.backAngleClosed), ...q(P.backAngleClosed), ...q(P.backAngleOpen)])).setBuffer(buffer);
  const sT = doc.createAnimationSampler().setInput(times).setOutput(trans).setInterpolation('LINEAR');
  const sR = doc.createAnimationSampler().setInput(rTimes).setOutput(rot).setInterpolation('LINEAR');
  doc.createAnimation('Abrir')
    .addSampler(sT).addSampler(sR)
    .addChannel(doc.createAnimationChannel().setTargetNode(nDrawers).setTargetPath('translation').setSampler(sT))
    .addChannel(doc.createAnimationChannel().setTargetNode(nBacks).setTargetPath('rotation').setSampler(sR));

  doc.getRoot().getAsset().generator = 'Provador 3D (protótipo)';
  await new NodeIO().registerExtensions([KHRMaterialsSheen, KHRMaterialsSpecular]).write(file, doc);
}

const normalJpg = await fabricNormalMap(path.join(OUT, 'tecido-normal.jpg'));
const meta = [];
for (const W of SIZES) {
  const t0 = Date.now();
  const s = buildSofa(W);
  const name = `sofa-${Math.round(W * 100)}.glb`;
  await writeGLB(s, normalJpg, path.join(OUT, name));
  const r2 = (x) => Math.round(x * 100) / 100;
  const m = {
    file: name, modules: s.n,
    width: r2(s.closed.max.x - s.closed.min.x),
    depthClosed: r2(s.closed.max.z - s.closed.min.z),
    depthOpen: r2(s.open.max.z - s.open.min.z),
    height: r2(s.closed.max.y - s.closed.min.y),
    // caixa em coordenadas do modelo (após centralizar em Z)
    box: (() => { const zc = (s.closed.min.z + s.closed.max.z) / 2, r3 = (x) => Math.round(x * 1000) / 1000;
      return { x: r3(s.closed.max.x), y: r3(s.closed.max.y), z0: r3(s.closed.min.z - zc), z1: r3(s.closed.max.z - zc), z0Open: r3(s.open.min.z - zc), z1Open: r3(s.open.max.z - zc) }; })(),
    bytes: fs.statSync(path.join(OUT, name)).size,
  };
  meta.push(m);
  console.log(JSON.stringify(m), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
fs.writeFileSync(path.join(OUT, 'medidas.json'), JSON.stringify(meta, null, 2));
