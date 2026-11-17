// Para cada fatia horizontal: quantos vértices e a extensão em x/z (mostra onde o pé vira corpo)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [file, y0 = '0.1', y1 = '0.4', dy = '0.005'] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
const pos = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray();
for (let y = +y0; y < +y1; y += +dy) {
  let n = 0, mx = 0, mz = 0, inner = 0;
  for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] >= y && pos[i + 1] < y + +dy) { n++; mx = Math.max(mx, Math.abs(pos[i])); mz = Math.max(mz, Math.abs(pos[i + 2])); if (Math.abs(pos[i]) < 0.15 && Math.abs(pos[i + 2]) < 0.15) inner++; }
  console.log(y.toFixed(3), 'n', String(n).padStart(5), '|x|', mx.toFixed(3), '|z|', mz.toFixed(3), 'miolo', inner);
}
