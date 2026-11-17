// Gera os sofás do Catálogo Artflex 2026 em 3D (formato aproximado, medidas reais).
// Uso: node build-catalog.mjs <pasta-saida> [ids...]
import * as THREE from 'three';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsSheen, KHRMaterialsSpecular } from '@gltf-transform/extensions';
import fs from 'node:fs';
import path from 'node:path';
import { roundedBox, cylinderPart, topPiping, transformPart, T, mergeParts, boxUV, bakeAO, buildBVH, fabricNormalMap } from './lib.mjs';

const OUT = process.argv[2] || 'out';
const ONLY = process.argv.slice(3);
fs.mkdirSync(OUT, { recursive: true });

// Medidas do catálogo (metros). D = profundidade fechado, Dopen = aberto, H = altura, armW = largura do braço.
const MODELS = [
  // retráteis: formato a partir das vistas de frente, lado e costas enviadas pela fábrica
  { id: 'valencia-250', W: 2.50, D: 1.00, Dopen: 1.40, H: 1.05, armW: 0.24, armH: 0.60, kind: 'retratil', recline: true, n: 2,
    style: { arm: 'box', back: 'single', seatT: 0.17, seatTufts: { cols: 4, rows: 3 }, backTufts: { cols: 4, rows: 3 }, flange: true } },
  { id: 'parma-230', W: 2.30, D: 1.00, Dopen: 1.40, H: 0.98, armW: 0.24, armH: 0.72, kind: 'retratil', recline: true, n: 2,
    style: { arm: 'pillow', back: 'lumbar', seatT: 0.19, seatTufts: { cols: 3, rows: 2 }, headTufts: { cols: 3, rows: 2 } } },
  { id: 'parma-320', W: 3.20, D: 1.00, Dopen: 1.40, H: 0.98, armW: 0.24, armH: 0.72, kind: 'retratil', recline: true, n: 3,
    style: { arm: 'pillow', back: 'lumbar', seatT: 0.19, seatTufts: { cols: 3, rows: 2 }, headTufts: { cols: 3, rows: 2 } } },
  { id: 'versalhes-182', W: 1.82, D: 0.90, Dopen: 1.26, H: 0.95, armW: 0.20, armH: 0.64, kind: 'retratil', recline: true, n: 2,
    style: { arm: 'box', back: 'lumbar', seatT: 0.11 } },
  { id: 'ibiza-210', W: 2.10, D: 0.95, Dopen: 1.30, H: 0.85, armW: 0.15, armH: 0.62, kind: 'retratil', recline: false, n: 2,
    style: { arm: 'box', back: 'single', seatT: 0.11, backTufts: { cols: 2, rows: 1 } } },
  { id: 'florenza-170', W: 1.70, D: 0.93, H: 0.86, armW: 0.15, armH: 0.60, kind: 'fixo', legs: 'base', n: 2 },
  { id: 'florenza-210', W: 2.10, D: 0.93, H: 0.86, armW: 0.15, armH: 0.60, kind: 'fixo', legs: 'base', n: 2 },
  { id: 'berlim-140', W: 1.40, D: 0.95, H: 0.85, armW: 0.15, armH: 0.62, kind: 'fixo', legs: 'palito', n: 2, tufts: { cols: 3, rows: 2 } },
  { id: 'berlim-170', W: 1.70, D: 0.95, H: 0.85, armW: 0.15, armH: 0.62, kind: 'fixo', legs: 'palito', n: 2, tufts: { cols: 3, rows: 2 } },
];

const GAP = 0.008;
const rotX = (deg) => new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(deg));
const rotZ = (rad) => new THREE.Matrix4().makeRotationZ(rad);

function armParts(m, y0, r, topBulge = 0.010) {
  const out = [];
  const h = m.armH - y0;
  for (const s of [-1, 1]) {
    const arm = roundedBox({ size: [m.armW, h, m.D], r, density: 0.07, bulge: [[0.006, 0.006], [0, topBulge], [0.004, 0.008]], exp: 3 });
    const M = T(s * (m.W / 2 - m.armW / 2 - 0.006), y0 + h / 2, m.D / 2);
    out.push(transformPart(arm, M));
    out.push(transformPart(topPiping([h, m.armW, m.D], r), M.clone().multiply(rotZ(s > 0 ? -Math.PI / 2 : Math.PI / 2))));
  }
  return out;
}

function woodBlock(w, h, d) {
  return roundedBox({ size: [w, h, d], r: Math.min(0.012, h / 2.5), density: 0.08, k: 2 });
}

// ---------- retrátil (e reclinável) ----------
function buildRetratil(m) {
  const fixed = [], drawers = [], backs = [], wood = [], plastic = [];
  const inner = m.W - 2 * m.armW, wm = inner / m.n;
  const feetH = 0.06, seatY0 = 0.10, seatTop = 0.47;
  fixed.push(...armParts(m, feetH, m.plushArms ? 0.09 : Math.min(0.065, m.armW * 0.33), m.plushArms ? 0.03 : 0.010));

  const seatZ0 = 0.01, seatZ1 = m.D - 0.012, seatH = seatTop - seatY0, seatD = seatZ1 - seatZ0;
  const travel = m.Dopen - m.D;
  const drH = 0.30, drD = Math.min(0.52, travel + 0.08);
  const T_ = Math.min(0.34, m.D - 0.60);
  const aC = m.recline ? -10 : -8, aO = m.recline ? -30 : aC;
  const pivotY = seatTop - 0.03;
  const sC = Math.sin(THREE.MathUtils.degToRad(-aC)), cC = Math.cos(THREE.MathUtils.degToRad(aC));
  const hb = (m.H - 0.012 - pivotY - T_ * sC) / cC;
  const pivotZ = hb * sC + 0.004;

  for (let i = 0; i < m.n; i++) {
    const cx = -inner / 2 + wm * (i + 0.5);
    const seat = roundedBox({ size: [wm - GAP, seatH, seatD], r: 0.05, density: 0.07, bulge: [[0.004, 0.004], [0, 0.022], [0, 0.010]], exp: 4 });
    const sM = T(cx, seatY0 + seatH / 2, (seatZ0 + seatZ1) / 2);
    fixed.push(transformPart(seat, sM), transformPart(topPiping([wm - GAP, seatH, seatD], 0.05), sM));

    const dr = roundedBox({ size: [wm - GAP - 0.012, drH, drD], r: 0.045, density: 0.07, bulge: [[0.003, 0.003], [0, 0.016], [0, 0.008]], exp: 4 });
    const dM = T(cx, 0.11 + drH / 2, seatZ1 - 0.006 - drD / 2);
    drawers.push(transformPart(dr, dM), transformPart(topPiping([wm - GAP - 0.012, drH, drD], 0.045), dM));

    const back = roundedBox({ size: [wm - GAP, hb, T_], r: 0.075, density: m.tufts ? 0.03 : 0.07, bulge: [[0.008, 0.008], [0.004, 0.012], [0.010, 0.036]], exp: 2, tufts: m.tufts ? { ...m.tufts, depth: 0.034, sigma: 0.022 } : null });
    const bM = T(cx, hb / 2, T_ / 2);
    backs.push(transformPart(back, bM), transformPart(topPiping([wm - GAP, T_, hb], 0.075), bM.clone().multiply(rotX(90))));
  }
  // pés de madeira sob os braços e apoios plásticos sob os assentos
  const bw = Math.min(m.armW - 0.05, 0.13);
  for (const s of [-1, 1]) for (const z of [m.D - 0.09, 0.09])
    wood.push(transformPart(woodBlock(bw, feetH, 0.10), T(s * (m.W / 2 - m.armW / 2 - 0.006), feetH / 2, z)));
  const fB = cylinderPart(0.022, 0.017, seatY0);
  for (let i = 1; i < m.n; i++) for (const z of [seatZ1 - 0.12, seatZ0 + 0.12])
    plastic.push(transformPart(fB, T(-inner / 2 + wm * i, seatY0 / 2, z)));

  return { fixed, drawers, backs, wood, plastic, travel, pivot: [0, pivotY, pivotZ], aC, aO, animated: true };
}


// ---------- retrátil com pillow top, encosto em duas peças e braço rolo ----------
// O assento inteiro (bloco da frente + almofada longa) desliza, como no retrátil de verdade.
function buildRetratilPlus(m) {
  const st = m.style;
  const fixed = [], drawers = [], backs = [], wood = [], plastic = [], deck = [], lumbars = [];
  const inner = m.W - 2 * m.armW, wm = inner / m.n;
  const feetH = 0.05, baseY0 = 0.10, baseTop = 0.30, seatTop = baseTop + st.seatT;
  const travel = m.Dopen - m.D;

  // braços
  for (const s of [-1, 1]) {
    if (st.arm === 'pillow') {
      const rh = 0.19, bodyTop = m.armH - rh + 0.03;
      const body = roundedBox({ size: [m.armW, bodyTop - feetH, m.D - 0.02], r: 0.04, density: 0.07, bulge: [[0.006, 0.006], [0, 0], [0.004, 0.006]], exp: 3 });
      fixed.push(transformPart(body, T(s * (m.W / 2 - m.armW / 2 - 0.006), feetH + (bodyTop - feetH) / 2, m.D / 2)));
      const rw = m.armW + 0.05;
      const roll = roundedBox({ size: [rw, rh, m.D - 0.025], r: 0.085, density: 0.06, bulge: [[0.014, 0.014], [0, 0.03], [0.01, 0.02]], exp: 2.5 });
      fixed.push(transformPart(roll, T(s * (m.W / 2 - rw / 2 - 0.008), m.armH - rh / 2 - 0.015, m.D / 2 + 0.004)));
    }
  }
  if (st.arm !== 'pillow') fixed.push(...armParts(m, feetH, Math.min(0.065, m.armW * 0.33)));

  // encosto (reclinável): pivô atrás, embaixo
  const aC = m.recline ? -10 : -8, aO = m.recline ? -30 : aC;
  const pivotY = seatTop - 0.035;
  const sC = Math.sin(THREE.MathUtils.degToRad(-aC)), cC = Math.cos(THREE.MathUtils.degToRad(aC));
  const frontT = st.back === 'lumbar' ? 0.17 : Math.min(0.34, m.D - 0.60);
  const hb = (m.H - 0.012 - pivotY - frontT * sC) / cC;
  const pivotZ = hb * sC + 0.004;
  // lombar cheia: sobe do assento até encostar no apoio de cabeça (como no 3D das fotos)
  const LUMB = { H: 0.40, T: 0.24, aC: -16, aO: -28, r: 0.10, bulge: [[0.016, 0.016], [0.01, 0.03], [0.006, 0.06]], zPanel: 0.14, ...(process.env.LUMB ? JSON.parse(process.env.LUMB) : {}) };
  const lumbarFront = st.back === 'lumbar' ? 0.30 : frontT; // em coordenadas locais do encosto
  const seatVisibleFrom = pivotZ + lumbarFront * cC + 0.03;

  for (let i = 0; i < m.n; i++) {
    const cx = -inner / 2 + wm * (i + 0.5);
    // base traseira fixa (fica escondida dentro do bloco da frente quando fechado)
    const rearD = m.D - 0.05, rh = baseTop - 0.012 - baseY0;
    fixed.push(transformPart(roundedBox({ size: [wm - GAP - 0.012, rh, rearD], r: 0.03, density: 0.08 }), T(cx, baseY0 + rh / 2, 0.015 + rearD / 2)));
    // base estofada fixa, logo abaixo do assento: com o sofá fechado fica dentro da almofada;
    // ao abrir, cobre o vão entre o encosto e o assento (antes aparecia a base baixa)
    const deckTop = seatTop - 0.03, deckZ0 = 0.02, deckD = 0.07 + travel + 0.10 - deckZ0;
    deck.push(transformPart(roundedBox({ size: [wm - GAP - 0.006, deckTop - baseTop + 0.02, deckD], r: 0.03, density: 0.06, bulge: [[0, 0], [0, 0.008], [0, 0]], exp: 3 }),
      T(cx, (deckTop + baseTop - 0.02) / 2, deckZ0 + deckD / 2)));
    // bloco da frente (desliza)
    const drD = Math.min(m.D - 0.10, travel + 0.12);
    const fb = roundedBox({ size: [wm - GAP, baseTop - baseY0, drD], r: 0.035, density: 0.07, bulge: [[0.003, 0.003], [0, 0], [0, 0.008]] });
    drawers.push(transformPart(fb, T(cx, baseY0 + (baseTop - baseY0) / 2, m.D - 0.02 - drD / 2)));
    // almofada do assento (longa: a parte de trás fica sob o encosto e aparece ao abrir)
    const z0s = 0.07, z1s = m.D + 0.004, sl = z1s - z0s, zcs = (z0s + z1s) / 2;
    const vis = [(seatVisibleFrom + 0.05 - zcs) / (sl / 2), (m.D - 0.07 - zcs) / (sl / 2)];
    const tufts = st.seatTufts ? { ...st.seatTufts, axis: 'y', depth: st.flange ? 0.036 : 0.026, sigma: st.flange ? 0.026 : 0.022, uRange: [-0.66, 0.66], vRange: vis } : null;
    const sr = Math.min(0.08, st.seatT * 0.45);
    const sp = roundedBox({ size: [wm - GAP, st.seatT, sl], r: sr, density: tufts ? 0.032 : 0.07, bulge: [[0.01, 0.01], [0, 0.036], [0, 0.045]], exp: 2.2, tufts });
    const spM = T(cx, baseTop + st.seatT / 2 - 0.005, zcs);
    drawers.push(transformPart(sp, spM), transformPart(st.flange ? topPiping([wm - GAP, st.seatT, sl], sr, 0.005, 0.018) : topPiping([wm - GAP, st.seatT, sl], sr), spM));

    if (st.back === 'lumbar') {
      const headH = 0.27, headT = frontT;
      const panelTop = hb - headH + 0.05, panelBot = -(pivotY - baseTop) - 0.01;
      const panel = roundedBox({ size: [wm - GAP, panelTop - panelBot, 0.10], r: 0.03, density: 0.08 });
      backs.push(transformPart(panel, T(cx, (panelTop + panelBot) / 2, 0.05)));
      // lombar: almofada larga e inclinada, deitada sobre o assento e encostada no encosto (peça separada;
      // origem na borda de baixo da frente, que fica sempre apoiada no assento)
      const lumbar = roundedBox({ size: [wm - GAP - 0.006, LUMB.H, LUMB.T], r: LUMB.r, density: 0.05, bulge: LUMB.bulge, exp: 2.2 });
      lumbars.push(transformPart(lumbar, T(cx, LUMB.H / 2, -LUMB.T / 2)));
      const head = roundedBox({ size: [wm - GAP, headH, headT], r: 0.06, density: st.headTufts ? 0.03 : 0.07, bulge: [[0.006, 0.006], [0.004, 0.012], [0.004, 0.025]], exp: 2,
        tufts: st.headTufts ? { ...st.headTufts, depth: 0.03, sigma: 0.02, marginX: 0.3, marginY: 0.35 } : null });
      const hM = T(cx, hb - headH / 2, headT / 2);
      backs.push(transformPart(head, hM), transformPart(topPiping([wm - GAP, headT, headH], 0.06), hM.clone().multiply(rotX(90))));
    } else {
      const back = roundedBox({ size: [wm - GAP, hb, frontT], r: 0.075, density: st.backTufts ? 0.03 : 0.07, bulge: st.flange ? [[0.015, 0.015], [0.006, 0.02], [0.012, 0.06]] : [[0.008, 0.008], [0.004, 0.012], [0.010, 0.036]], exp: 2,
        tufts: st.backTufts ? { ...st.backTufts, depth: st.flange ? 0.042 : 0.034, sigma: st.flange ? 0.028 : 0.022, marginX: st.flange ? 0.3 : 0.16, marginY: st.flange ? 0.34 : 0.2 } : null });
      const bM = T(cx, hb / 2, frontT / 2);
      backs.push(transformPart(back, bM), transformPart(st.flange ? topPiping([wm - GAP, frontT, hb], 0.075, 0.005, 0.018) : topPiping([wm - GAP, frontT, hb], 0.075), bM.clone().multiply(rotX(90))));
    }
  }
  // pés: blocos de madeira sob os braços, apoios plásticos sob os módulos
  const bw = Math.min(m.armW - 0.04, 0.16);
  for (const s of [-1, 1]) for (const z of [m.D - 0.10, 0.10])
    wood.push(transformPart(woodBlock(bw, feetH, 0.13), T(s * (m.W / 2 - m.armW / 2 - 0.006), feetH / 2, z)));
  const fB = cylinderPart(0.022, 0.017, baseY0);
  for (let i = 0; i <= m.n; i++) for (const z of [m.D - 0.14, 0.12]) {
    const x = -inner / 2 + wm * i + (i === 0 ? 0.06 : i === m.n ? -0.06 : 0);
    plastic.push(transformPart(fB, T(x, baseY0 / 2, z)));
  }
  return { fixed, drawers, backs, wood, plastic, deck, lumbar: lumbars.length ? { parts: lumbars, ...LUMB, y: seatTop - 0.022 } : null, singleBack: st.back !== 'lumbar', travel, pivot: [0, pivotY, pivotZ], aC, aO, animated: true };
}

// ---------- fixo (almofadas soltas) ----------
function buildFixo(m) {
  const fixed = [], backs = [], wood = [], plastic = [];
  const inner = m.W - 2 * m.armW, wc = inner / m.n;
  const y0 = m.legs === 'palito' ? 0.17 : 0.065;
  fixed.push(...armParts(m, y0, 0.045));

  const frameT = 0.15, frameTop = m.H - 0.10, deckTop = 0.33, seatTop = 0.455;
  const frame = roundedBox({ size: [inner + 0.02, frameTop - y0, frameT], r: 0.04, density: 0.08, bulge: [[0, 0], [0, 0.006], [0.004, 0.004]] });
  fixed.push(transformPart(frame, T(0, y0 + (frameTop - y0) / 2, frameT / 2)));
  const deckD = m.D - frameT - 0.005;
  const deck = roundedBox({ size: [inner + 0.02, deckTop - y0, deckD], r: 0.03, density: 0.08 });
  fixed.push(transformPart(deck, T(0, y0 + (deckTop - y0) / 2, frameT + deckD / 2)));

  const seatH = seatTop - deckTop, seatD = m.D - frameT - 0.012;
  const bt = 0.20, a = -13;
  const s_ = Math.sin(THREE.MathUtils.degToRad(-a)), c_ = Math.cos(THREE.MathUtils.degToRad(a));
  const pivotY = seatTop - 0.03;
  const hb = (m.H - 0.012 - pivotY - bt * s_) / c_;
  const pivotZ = frameT + 0.012;
  for (let i = 0; i < m.n; i++) {
    const cx = -inner / 2 + wc * (i + 0.5);
    const seat = roundedBox({ size: [wc - GAP, seatH, seatD], r: 0.045, density: 0.07, bulge: [[0.006, 0.006], [0.004, 0.024], [0.006, 0.012]], exp: 2.5 });
    const sM = T(cx, deckTop + seatH / 2, frameT + 0.004 + seatD / 2);
    fixed.push(transformPart(seat, sM), transformPart(topPiping([wc - GAP, seatH, seatD], 0.045), sM));
    const back = roundedBox({ size: [wc - GAP, hb, bt], r: 0.07, density: m.tufts ? 0.03 : 0.07, bulge: [[0.01, 0.01], [0.006, 0.016], [0.010, 0.040]], exp: 2, tufts: m.tufts ? { ...m.tufts, depth: 0.03, sigma: 0.022 } : null });
    const bM = T(cx, hb / 2, bt / 2);
    backs.push(transformPart(back, bM), transformPart(topPiping([wc - GAP, bt, hb], 0.07), bM.clone().multiply(rotX(90))));
  }
  if (m.legs === 'base') {
    wood.push(transformPart(woodBlock(m.W - 0.05, 0.05, m.D - 0.07), T(0, 0.012 + 0.025, m.D / 2 - 0.01)));
    const f = cylinderPart(0.02, 0.016, 0.012);
    for (const s of [-1, 1]) for (const z of [m.D - 0.10, 0.10]) plastic.push(transformPart(f, T(s * (m.W / 2 - 0.10), 0.006, z)));
  } else {
    // pés palito inclinados
    const legH = y0 + 0.01, leg = cylinderPart(0.016, 0.024, legH / Math.cos(0.17));
    for (const s of [-1, 1]) for (const [z, tz] of [[m.D - 0.08, 1], [0.08, -1]]) {
      const M = T(s * (m.W / 2 - 0.08), legH / 2, z).multiply(rotZ(-s * 0.17)).multiply(rotX(tz * 8));
      wood.push(transformPart(leg, M));
    }
  }
  return { fixed, drawers: [], backs, wood, plastic, travel: 0, pivot: [0, pivotY, pivotZ], aC: a, aO: a, animated: false };
}

// ---------- montagem, AO e exportação ----------
const q = (deg) => { const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(deg)); return [qq.x, qq.y, qq.z, qq.w]; };
const floor = (() => { const g = new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2); return { pos: Float32Array.from(g.attributes.position.array), nrm: Float32Array.from(g.attributes.normal.array), idx: Uint32Array.from(g.index.array) }; })();
const bbox = (parts) => { const b = new THREE.Box3(), v = new THREE.Vector3(); for (const p of parts) for (let i = 0; i < p.pos.length; i += 3) b.expandByPoint(v.fromArray(p.pos, i)); return b; };
const empty = { pos: new Float32Array(0), nrm: new Float32Array(0), idx: new Uint32Array(0) };

async function build(m, normalJpg) {
  // constrói, mede e corrige até bater com as medidas do catálogo (o estufamento das almofadas soma alguns mm)
  let spec = { ...m }, g, fixedM, drawersM, backsM, woodM, plasticM, pivot, backC;
  const M = (arr) => (arr.length ? mergeParts(arr) : null);
  for (let it = 0; it < 4; it++) {
    g = spec.kind === 'retratil' ? (spec.style ? buildRetratilPlus(spec) : buildRetratil(spec)) : buildFixo(spec);
    fixedM = M(g.fixed); drawersM = M(g.drawers); backsM = M(g.backs); woodM = M(g.wood); plasticM = M(g.plastic);
    pivot = T(...g.pivot);
    backC = transformPart(backsM, pivot.clone().multiply(rotX(g.aC)));
    const b = bbox([fixedM, woodM, plasticM, backC].filter(Boolean));
    const eW = m.W - (b.max.x - b.min.x), eD = m.D - (b.max.z - b.min.z), eH = m.H - (b.max.y - b.min.y);
    if (Math.max(Math.abs(eW), Math.abs(eD), Math.abs(eH)) < 0.0015) break;
    spec = { ...spec, W: spec.W + eW, D: spec.D + eD, H: spec.H + eH };
    if (m.Dopen) spec.Dopen = spec.D + (m.Dopen - m.D);
  }
  // ao reclinar, o pé do encosto acompanha o assento: avança o bastante para o fundo do encosto não passar de onde estava fechado
  const bC = bbox([backC]), bNoMove = bbox([transformPart(backsM, pivot.clone().multiply(rotX(g.aO)))]);
  const follow = g.aO !== g.aC ? Math.max(0, bC.min.z - bNoMove.min.z) : 0;
  const pivotO = [g.pivot[0], g.pivot[1], g.pivot[2] + follow];
  if (g.singleBack && g.aO !== g.aC) {
    // encosto inteiriço: ao reclinar a borda de baixo da frente levantava do assento; abaixa o encosto o quanto ela subiu
    const fb = (M) => { let mn = 1e9; const v = new THREE.Vector3(); const bl = bbox([backsM]);
      for (let i = 0; i < backsM.pos.length; i += 3) { if (backsM.pos[i + 1] > bl.min.y + 0.08 || backsM.pos[i + 2] < bl.max.z - 0.10) continue; v.fromArray(backsM.pos, i).applyMatrix4(M); mn = Math.min(mn, v.y); } return mn; };
    pivotO[1] += fb(pivot.clone().multiply(rotX(g.aC))) - fb(T(...pivotO).multiply(rotX(g.aO)));
  }
  const backO = transformPart(backsM, T(...pivotO).multiply(rotX(g.aO)));
  // lombar: borda da frente apoiada no assento; o canto de cima de trás encosta no painel do encosto
  let lumbarM = null, lumPC = null, lumPO = null, lumC = null, lumO = null;
  if (g.lumbar) {
    const L = g.lumbar; lumbarM = mergeParts(L.parts);
    const corner = [L.H - 0.03, -L.T + 0.03], d2r = Math.PI / 180;
    const pose = (bp, bAng, lAng) => {
      const tb = bAng * d2r, tl = lAng * d2r, zPanel = L.zPanel;
      const Q = [bp[1] - zPanel * Math.sin(tb), bp[2] + zPanel * Math.cos(tb)], nrm = [-Math.sin(tb), Math.cos(tb)];
      const c = [corner[0] * Math.cos(tl) - corner[1] * Math.sin(tl), corner[0] * Math.sin(tl) + corner[1] * Math.cos(tl)];
      return [0, L.y, Q[1] - c[1] - (L.y + c[0] - Q[0]) * nrm[0] / nrm[1]];
    };
    lumPC = pose(g.pivot, g.aC, L.aC); lumPO = pose(pivotO, g.aO, L.aO);
    lumC = transformPart(lumbarM, T(...lumPC).multiply(rotX(L.aC))); lumO = transformPart(lumbarM, T(...lumPO).multiply(rotX(L.aO)));
  }
  const deckM = g.deck && g.deck.length ? mergeParts(g.deck) : null;
  const drO = drawersM ? transformPart(drawersM, T(0, 0, g.travel)) : null;
  const statics = [fixedM, woodM, plasticM].filter(Boolean);
  const bvhC = buildBVH([...statics, backC, ...(lumC ? [lumC] : []), floor]);
  const bvhO = buildBVH([...statics, backO, ...(lumO ? [lumO] : []), ...(drO ? [drO] : []), floor]);
  if (lumbarM) lumbarM.ao = bakeAO(lumC, bvhC);
  fixedM.ao = bakeAO(fixedM, bvhC); backsM.ao = bakeAO(backC, bvhC);
  if (woodM) woodM.ao = bakeAO(woodM, bvhC);
  if (plasticM) plasticM.ao = bakeAO(plasticM, bvhC);
  if (drawersM) drawersM.ao = bakeAO(drO, bvhO);
  if (deckM) deckM.ao = bakeAO(deckM, bvhO);
  const closed = bbox([...statics, backC]);
  const open = bbox([...statics, backO, ...(drO ? [drO] : [])]);

  const doc = new Document();
  const buffer = doc.createBuffer();
  const sheenExt = doc.createExtension(KHRMaterialsSheen), specExt = doc.createExtension(KHRMaterialsSpecular);
  const tex = doc.createTexture('tecido_normal').setImage(normalJpg).setMimeType('image/jpeg');
  const fabric = doc.createMaterial('Tecido').setBaseColorFactor([0.30, 0.31, 0.32, 1]).setRoughnessFactor(0.92).setMetallicFactor(0).setNormalTexture(tex).setNormalScale(0.55);
  fabric.setExtension('KHR_materials_sheen', sheenExt.createSheen().setSheenColorFactor([0.5, 0.5, 0.52]).setSheenRoughnessFactor(0.55));
  fabric.setExtension('KHR_materials_specular', specExt.createSpecular().setSpecularFactor(0.25));
  const woodMat = doc.createMaterial('Madeira').setBaseColorFactor([0.21, 0.08, 0.03, 1]).setRoughnessFactor(0.42).setMetallicFactor(0);
  const plasticMat = doc.createMaterial('Pes').setBaseColorFactor([0.025, 0.022, 0.02, 1]).setRoughnessFactor(0.45).setMetallicFactor(0);

  const prim = (part, mat, uv) => {
    const n = part.pos.length / 3, color = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) { const a = Math.round(part.ao[i] * 255); color.set([a, a, a, 255], i * 4); }
    const p = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(part.pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(part.nrm).setBuffer(buffer))
      .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(color).setNormalized(true).setBuffer(buffer))
      .setMaterial(mat);
    if (uv) p.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(boxUV(part)).setBuffer(buffer));
    p.setIndices(doc.createAccessor().setType('SCALAR').setArray(n < 65535 ? Uint16Array.from(part.idx) : part.idx).setBuffer(buffer));
    return p;
  };
  const node = (name, part, mat, uv) => doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim(part, mat, uv)));

  const zc = (closed.min.z + closed.max.z) / 2;
  const root = doc.createNode('Sofa').setTranslation([0, 0, -zc]);
  root.addChild(node('Estrutura', fixedM, fabric, true));
  if (woodM) root.addChild(node('Madeira', woodM, woodMat, false));
  if (plasticM) root.addChild(node('Pes', plasticM, plasticMat, false));
  const nBacks = node('Encostos', backsM, fabric, true).setTranslation(g.pivot).setRotation(q(g.aC));
  root.addChild(nBacks);
  let nDr = null;
  if (drawersM) { nDr = node('Retratil', drawersM, fabric, true); root.addChild(nDr); }
  if (deckM) root.addChild(node('BaseAssento', deckM, fabric, true));
  let nLum = null;
  if (lumbarM) { nLum = node('Lombar', lumbarM, fabric, true).setTranslation(lumPC).setRotation(q(g.lumbar.aC)); root.addChild(nLum); }
  doc.createScene('Cena').addChild(root);

  if (g.animated) {
    const acc = (type, arr) => doc.createAccessor().setType(type).setArray(new Float32Array(arr)).setBuffer(buffer);
    const anim = doc.createAnimation('Abrir');
    const sT = doc.createAnimationSampler().setInput(acc('SCALAR', [0, 0.45, 1.2])).setOutput(acc('VEC3', [0, 0, 0, 0, 0, g.travel * 0.62, 0, 0, g.travel])).setInterpolation('LINEAR');
    anim.addSampler(sT).addChannel(doc.createAnimationChannel().setTargetNode(nDr).setTargetPath('translation').setSampler(sT));
    if (g.aO !== g.aC) {
      const sR = doc.createAnimationSampler().setInput(acc('SCALAR', [0, 0.4, 1.2])).setOutput(acc('VEC4', [...q(g.aC), ...q(g.aC), ...q(g.aO)])).setInterpolation('LINEAR');
      anim.addSampler(sR).addChannel(doc.createAnimationChannel().setTargetNode(nBacks).setTargetPath('rotation').setSampler(sR));
      if (nLum) {
        const sLT = doc.createAnimationSampler().setInput(acc('SCALAR', [0, 0.4, 1.2])).setOutput(acc('VEC3', [...lumPC, ...lumPC, ...lumPO])).setInterpolation('LINEAR');
        const sLR = doc.createAnimationSampler().setInput(acc('SCALAR', [0, 0.4, 1.2])).setOutput(acc('VEC4', [...q(g.lumbar.aC), ...q(g.lumbar.aC), ...q(g.lumbar.aO)])).setInterpolation('LINEAR');
        anim.addSampler(sLT).addSampler(sLR)
          .addChannel(doc.createAnimationChannel().setTargetNode(nLum).setTargetPath('translation').setSampler(sLT))
          .addChannel(doc.createAnimationChannel().setTargetNode(nLum).setTargetPath('rotation').setSampler(sLR));
      }
      if (follow > 0 || pivotO[1] !== g.pivot[1]) {
        const sBT = doc.createAnimationSampler().setInput(acc('SCALAR', [0, 0.4, 1.2])).setOutput(acc('VEC3', [...g.pivot, ...g.pivot, ...pivotO])).setInterpolation('LINEAR');
        anim.addSampler(sBT).addChannel(doc.createAnimationChannel().setTargetNode(nBacks).setTargetPath('translation').setSampler(sBT));
      }
    }
  }
  doc.getRoot().getAsset().generator = 'Provador 3D Artflex (protótipo)';
  const file = path.join(OUT, `${m.id}.glb`);
  await new NodeIO().registerExtensions([KHRMaterialsSheen, KHRMaterialsSpecular]).write(file, doc);

  const r3 = (x) => Math.round(x * 1000) / 1000;
  return {
    id: m.id, bytes: fs.statSync(file).size, encostoAvanca: r3(follow), encostoDesce: r3(g.pivot[1] - pivotO[1]), lombarFrente: lumPC ? [r3(lumPC[2]), r3(lumPO[2])] : null,
    medido: { W: r3(closed.max.x - closed.min.x), D: r3(closed.max.z - closed.min.z), H: r3(closed.max.y - closed.min.y), Dopen: r3(closed.max.z + g.travel - closed.min.z) },
    caixa: { x: r3(closed.max.x), y: r3(closed.max.y), z0: r3(closed.min.z - zc), z1: r3(closed.max.z - zc), z1Aberto: r3(closed.max.z - zc + g.travel) },
  };
}

const normalJpg = await fabricNormalMap(path.join(OUT, 'tecido-normal.jpg'));
const meta = [];
for (const m of MODELS) {
  if (ONLY.length && !ONLY.includes(m.id)) continue;
  const t0 = Date.now();
  const r = await build(m, normalJpg);
  meta.push(r);
  console.log(m.id, JSON.stringify(r.medido), `catálogo W${m.W} D${m.D} H${m.H}${m.Dopen ? ' aberto ' + m.Dopen : ''}`, (r.bytes / 1024).toFixed(0) + 'KB', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
fs.writeFileSync(path.join(OUT, 'medidas.json'), JSON.stringify(meta, null, 2));
fs.rmSync(path.join(OUT, 'tecido-normal.jpg'));
