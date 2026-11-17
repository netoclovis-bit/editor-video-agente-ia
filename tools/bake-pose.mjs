// "Congela" um modelo animado na pose do fim da animação (ex.: poltrona reclinada), sem esqueleto nem animação.
// Usado no iPhone: o arquivo de realidade aumentada da Apple não leva a pose de malhas com esqueleto.
// Uso: node tools/bake-pose.mjs <entrada.glb> <saida.glb>
import { NodeIO } from '@gltf-transform/core';
import { KHRMaterialsSheen, KHRMaterialsSpecular } from '@gltf-transform/extensions';

const [IN, OUT] = process.argv.slice(2);
const io = new NodeIO().registerExtensions([KHRMaterialsSheen, KHRMaterialsSpecular]);
const doc = await io.read(IN);
const root = doc.getRoot();

// 1) cada nó animado vai para o último quadro da animação
for (const anim of root.listAnimations()) {
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode(), path = ch.getTargetPath(), out = ch.getSampler().getOutput().getArray();
    const n = path === 'rotation' ? 4 : 3, last = Array.from(out.slice(out.length - n));
    if (path === 'rotation') node.setRotation(last); else if (path === 'translation') node.setTranslation(last); else if (path === 'scale') node.setScale(last);
  }
}

// matrizes 4x4 (coluna principal, como no glTF)
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };

// 2) malhas com esqueleto: aplica a pele (soma ponderada das juntas) nas posições e normais
for (const node of root.listNodes()) {
  const skin = node.getSkin(), mesh = node.getMesh();
  if (!skin || !mesh) continue;
  const joints = skin.listJoints(), ibm = skin.getInverseBindMatrices().getArray();
  const M = joints.map((j, i) => mul(j.getWorldMatrix(), Array.from(ibm.slice(i * 16, i * 16 + 16))));
  const done = new Set();
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), Nn = prim.getAttribute('NORMAL'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
    if (!J || !W || done.has(P)) continue;
    done.add(P);
    const p = P.getArray(), nr = Nn ? Nn.getArray() : null, j = J.getArray(), w = W.getArray(), wn = W.getNormalized() ? 255 : 1;
    const np = new Float32Array(p.length), nn = nr ? new Float32Array(nr.length) : null;
    for (let v = 0; v < p.length / 3; v++) {
      const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
      let ox = 0, oy = 0, oz = 0, nx = 0, ny = 0, nz = 0;
      for (let k = 0; k < 4; k++) {
        const wt = w[v * 4 + k] / wn; if (!wt) continue;
        const m = M[j[v * 4 + k]];
        ox += wt * (m[0] * x + m[4] * y + m[8] * z + m[12]); oy += wt * (m[1] * x + m[5] * y + m[9] * z + m[13]); oz += wt * (m[2] * x + m[6] * y + m[10] * z + m[14]);
        if (nr) { const a = nr[v * 3], b = nr[v * 3 + 1], c = nr[v * 3 + 2]; nx += wt * (m[0] * a + m[4] * b + m[8] * c); ny += wt * (m[1] * a + m[5] * b + m[9] * c); nz += wt * (m[2] * a + m[6] * b + m[10] * c); }
      }
      np[v * 3] = ox; np[v * 3 + 1] = oy; np[v * 3 + 2] = oz;
      if (nn) { const L = Math.hypot(nx, ny, nz) || 1; nn[v * 3] = nx / L; nn[v * 3 + 1] = ny / L; nn[v * 3 + 2] = nz / L; }
    }
    P.setArray(np); if (Nn) Nn.setArray(nn);
  }
  for (const prim of mesh.listPrimitives()) { prim.setAttribute('JOINTS_0', null); prim.setAttribute('WEIGHTS_0', null); }
  node.setSkin(null);
  skin.dispose();
}
for (const a of root.listAnimations()) a.dispose();
for (const a of root.listAccessors()) if (!a.listParents().some((p) => p !== root)) a.dispose();
root.getAsset().generator = 'Provador 3D Artflex (pose fixa para realidade aumentada no iPhone)';
await io.write(OUT, doc);
console.log('ok', OUT);
