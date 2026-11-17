import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsSheen, KHRMaterialsSpecular } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
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
function roundedBox({ size, r, k = 4, density = 0.07, bulge = [[0, 0], [0, 0], [0, 0]], exp = 2, tufts = null }) {
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
    // capitonê: afundamentos na face +Z (frente da almofada)
    // capitonê: afundamentos numa face (+Z por padrão, ou +Y para o topo do assento)
    const ta = tufts ? (tufts.axis === 'y' ? 1 : 2) : -1;
    if (tufts && q[ta] > 0.2) {
      const wz = Math.min(1, (q[ta] - 0.2) / 0.6);
      const va = ta === 2 ? 1 : 2;
      const { cols, rows, depth = 0.02, sigma = 0.024, marginX = 0.16, marginY = 0.2 } = tufts;
      const uR = tufts.uRange || [-(1 - marginX), 1 - marginX], vR = tufts.vRange || [-(1 - marginY), 1 - marginY];
      let sum = 0;
      for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
        const tx = H[0] * (uR[0] + (uR[1] - uR[0]) * (cols === 1 ? 0.5 : c / (cols - 1)));
        const ty = H[va] * (vR[0] + (vR[1] - vR[0]) * (rows === 1 ? 0.5 : rr / (rows - 1)));
        const dx = p[0] - tx, dy = p[va] - ty;
        sum += Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      }
      rp[ta] -= depth * Math.min(1, sum) * wz;
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
function pipingLoop(hx, hz, rc, tubeR = 0.0034, radial = 6, step = 0.08, sideR = null) {
  const rs = sideR || tubeR;
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
      const nx = cs / rs, ny = sn / tubeR, nl = Math.hypot(nx, ny);
      nrm.push((nx / nl) * sx, ny / nl, (nx / nl) * sz);
      pos.push(pts[i][0] + cs * rs * sx, sn * tubeR, pts[i][1] + cs * rs * sz);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = ((i + 1) % N) * radial + j, d = ((i + 1) % N) * radial + ((j + 1) % radial);
    idx.push(a, c, b, b, c, d);
  }
  return { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), idx: Uint32Array.from(idx) };
}
// contorno a 45° na aresta arredondada de uma caixa (face +Y), em coordenadas locais da caixa
function topPiping(size, r, tubeR = 0.0034, sideR = null) {
  const s45 = Math.SQRT1_2, [w, h, d] = size;
  const loop = sideR ? pipingLoop(w / 2 - r + r * s45, d / 2 - r + r * s45, r * s45, tubeR, 8, 0.08, sideR) : pipingLoop(w / 2 - r + r * s45, d / 2 - r + r * s45, r * s45, tubeR);
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
  const n = part.pos.length / 3, uv = new Float32Array(n * 2), t = 4.0;
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


export { grid, roundedBox, smoothNormals, cylinderPart, pipingLoop, topPiping, transformPart, T, mergeParts, boxUV, bakeAO, buildBVH, fabricNormalMap };
