import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'meshopt.decoder': MeshoptDecoder });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const r = doc.getRoot();
  const b = getBounds(r.listScenes()[0]);
  const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(3));
  let tris = 0, verts = 0;
  const attrs = new Set();
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) { verts += p.getAttribute('POSITION').getCount(); tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3; p.listSemantics().forEach((s) => attrs.add(s)); }
  console.log(f.split('/').pop(), 'ext', r.listExtensionsUsed().map((e) => e.extensionName).join(','), '| nodes', r.listNodes().length, 'meshes', r.listMeshes().length, 'mats', r.listMaterials().length, 'tex', r.listTextures().length, '| verts', verts, 'tris', tris, '| attrs', [...attrs].join(','), '| size', JSON.stringify(size), 'min', JSON.stringify(b.min.map((v) => +v.toFixed(3))));
  for (const n of r.listNodes()) { const t = n.getTranslation(), q = n.getRotation(), s = n.getScale(); if (t.some(Boolean) || q[3] !== 1 || s.some((x) => x !== 1)) console.log('   node', n.getName(), 'T', t.map((v) => +v.toFixed(3)), 'R', q.map((v) => +v.toFixed(3)), 'S', s.map((v) => +v.toFixed(3))); }
  for (const m of r.listMaterials()) console.log('   mat', m.getName(), m.getBaseColorFactor().map((v) => +v.toFixed(2)), 'tex', !!m.getBaseColorTexture());
}
