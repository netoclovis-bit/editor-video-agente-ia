import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/core';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
console.log('scenes', root.listScenes().length);
for (const s of root.listScenes()) console.log('bounds', JSON.stringify(getBounds(s)));
for (const n of root.listNodes()) console.log('node', n.getName(), 'mesh', n.getMesh()?.getName(), 'T', n.getTranslation(), 'R', n.getRotation(), 'S', n.getScale(), 'light', !!n.getExtension('KHR_lights_punctual'), 'children', n.listChildren().map(c=>c.getName()));
for (const m of root.listMeshes()) { for (const p of m.listPrimitives()) { const pos=p.getAttribute('POSITION'); console.log('mesh', m.getName(), 'verts', pos.getCount(), 'min', pos.getMin([]), 'max', pos.getMax([]), 'mat', p.getMaterial()?.getName(), 'attrs', p.listSemantics()); const v=p.getExtension('KHR_materials_variants'); if(v) console.log('  variants mappings', v.listMappings().map(mp=>[mp.getMaterial().getName(), mp.listVariants().map(x=>x.getName())])); } }
for (const mat of root.listMaterials()) { console.log('mat', mat.getName(), 'base', mat.getBaseColorFactor(), 'baseTex', mat.getBaseColorTexture()?.getName(), 'rough', mat.getRoughnessFactor(), 'metal', mat.getMetallicFactor(), 'normalTex', mat.getNormalTexture()?.getName(), 'occTex', mat.getOcclusionTexture()?.getName(), 'ext', mat.listExtensions().map(e=>e.extensionName)); const sh = mat.getExtension('KHR_materials_sheen'); if (sh) console.log('   sheen', sh.getSheenColorFactor(), sh.getSheenRoughnessFactor(), sh.getSheenColorTexture()?.getName()); const sp=mat.getExtension('KHR_materials_specular'); if(sp) console.log('   spec', sp.getSpecularFactor(), sp.getSpecularColorFactor()); const ti = mat.getNormalTextureInfo(); if (ti) { const tt = ti.getExtension('KHR_texture_transform'); console.log('   normal tt', tt && [tt.getScale(), tt.getOffset()], 'texCoord', ti.getTexCoord()); } }
for (const t of root.listTextures()) console.log('tex', t.getName(), t.getMimeType(), t.getSize(), t.getImage().byteLength);
