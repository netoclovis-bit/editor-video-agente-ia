// Mede os postes (pés) do puff: perfil |z| máximo por faixa de altura, na região dos pés
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[2]);
const pos = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray();
const rows = {};
for (let i = 0; i < pos.length; i += 3) {
  const x = Math.abs(pos[i]), y = pos[i + 1], z = Math.abs(pos[i + 2]);
  const k = (Math.round(y / 0.02) * 0.02).toFixed(2);
  const r = rows[k] ||= { post: 0, mid: 0, xs: [1, 0] };
  if (x > 0.26 && x < 0.37) { r.post = Math.max(r.post, z); if (z > 0.236) { r.xs[0] = Math.min(r.xs[0], x); r.xs[1] = Math.max(r.xs[1], x); } }
  if (x < 0.15) r.mid = Math.max(r.mid, z);
}
for (const k of Object.keys(rows).sort((a, b) => a - b)) if (+k >= 0.1 && +k <= 0.42) console.log('y', k, '| z máx na região do pé', rows[k].post.toFixed(3), '| z máx no meio', rows[k].mid.toFixed(3), '| x do poste', rows[k].xs.map((v) => v.toFixed(3)).join('–'));
