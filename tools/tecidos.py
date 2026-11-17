# Recorta as amostras do mostruário, tira a cor média e gera a textura de cada tecido.
import sys, json, os, glob
import numpy as np
from PIL import Image, ImageFilter
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
# página: (tecido, grupo, acabamento, [cores de cima para baixo])
PAGES = {
 3: ('Harmonia','A','trama',['Marfim']),
 5: ('Texcouro','B','couro',['Ocre','Caramelo','Marrom','Preto']),
 7: ('JY','C','trama',['04','02','03']),
 9: ('JL','C','trama',['01','02']),
 11:('Linen','C','trama',['01','14']),
 13:('Jamaica','C','trama',['41','80']),
 15:('Bouclê','D','boucle',['02','03']),
 17:('Acorde','D','suede',['Verde','Terracota']),
 19:('Zavatex','D','trama',['Cinza']),
 21:('Deva','D','trama',['Natural','Creme','Cinza']),
 23:('Saturno','E','trama',['Cru','Cinza','Tabaco']),
 25:('Veludo Slim','E','veludo',['Marfim','Camurça','Chocolate','Terracota','Marinho']),
}
slug = lambda s: s.lower().replace(' ','-').replace('ê','e').replace('ç','c')
def tileable(gray):
    # cruza a imagem com ela mesma deslocada meio quadro: as bordas passam a se encaixar
    h, w = gray.shape
    rolled = np.roll(np.roll(gray, h//2, 0), w//2, 1)
    y = np.minimum(np.arange(h), h-1-np.arange(h)) / (h/2); x = np.minimum(np.arange(w), w-1-np.arange(w)) / (w/2)
    m = np.clip(np.minimum.outer(y, x) * 2.2, 0, 1); m = m*m*(3-2*m)
    return gray*m + rolled*(1-m)
out = []
for p, (fab, grp, acab, cores) in PAGES.items():
    im = Image.open(glob.glob(f'{SRC}/hi-{p}-*.png')[0]).convert('RGB'); W, H = im.size
    n = len(cores); bh = H / n
    fam = {'nome': fab, 'grupo': grp, 'acabamento': acab, 'cores': []}
    for i, cor in enumerate(cores):
        y0, y1 = int(i*bh + bh*0.07), int(i*bh + bh*(0.80 if n > 1 else 0.85))
        x0, x1 = int(W*0.42), int(W*0.96)
        crop = im.crop((x0, y0, x1, y1))
        a = np.asarray(crop).astype(np.float32)
        med = np.median(a.reshape(-1,3), axis=0)
        hexc = '#%02x%02x%02x' % tuple(int(round(v)) for v in med)
        # miniatura quadrada para o botão de cor
        s = min(crop.size); c = crop.crop(((crop.width-s)//2, (crop.height-s)//2, (crop.width+s)//2, (crop.height+s)//2)).resize((128,128), Image.LANCZOS)
        name = f'tec-{slug(fab)}-{slug(cor)}.webp'; c.save(f'{OUT}/{name}', quality=82, method=6)
        fam['cores'].append({'nome': cor, 'hex': hexc, 'foto': name})
        if i == 0:
            # textura de detalhe (cinza, média clara), repetível
            s = min(crop.size); sq = crop.crop((0, 0, s, s)).resize((512,512), Image.LANCZOS)
            g = np.asarray(sq.convert('L')).astype(np.float32) / 255
            low = np.asarray(Image.fromarray((g*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(28))).astype(np.float32)/255
            d = g / np.maximum(low, 0.05)          # tira a iluminação da foto, fica só a trama
            d = (d - d.mean()) / (d.std() + 1e-6)
            strength = {'trama':0.10,'boucle':0.13,'suede':0.06,'veludo':0.05,'couro':0.06}[acab]
            t = np.clip(0.88 + d*strength, 0.55, 1.0)
            t = tileable(t)
            tex = f'tex-{slug(fab)}.jpg'; Image.fromarray((t*255).astype(np.uint8)).save(f'{OUT}/{tex}', quality=85)
            fam['textura'] = tex
    out.append(fam)
json.dump(out, open(f'{OUT}/tecidos.json','w'), ensure_ascii=False, indent=1)
for f in out: print(f['grupo'], f['nome'].ljust(11), f['acabamento'].ljust(6), ' '.join(c['nome']+':'+c['hex'] for c in f['cores']))
