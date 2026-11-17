# Gera as páginas das duas lojas a partir da página-base, prontas para publicar no site.
#
# Uso:
#   python tools/publicar.py provador-base.html <pasta-do-site>
#
# <pasta-do-site> é uma cópia do ramo provador-site, por exemplo:
#   git worktree add ../provador-site provador-site
#
# Depois, dentro da pasta do site:
#   git add -A && git commit -m "Descreva a mudança" && git push
# e o Cloudflare Pages (projeto projeto-3d) publica sozinho em cerca de 1 minuto.
import os
import re
import subprocess
import sys
import tempfile

base, site = sys.argv[1], sys.argv[2]
aqui = os.path.dirname(os.path.abspath(__file__))

# Cabeçalho mínimo da página publicada (a página-base vem sem <html>/<head>, como no artifact).
HEAD = ('<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);'
        'padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}'
        '[hidden]{display:none!important}</style></head><body>\n')

with tempfile.TemporaryDirectory() as t:
    a, b = os.path.join(t, 'sofa.html'), os.path.join(t, 'deco.html')
    subprocess.run([sys.executable, os.path.join(aqui, 'lojas.py'), base, a, b], check=True)
    for src, dst in [(a, 'sofa-outlet.html'), (b, 'decorart.html')]:
        s = open(src, encoding='utf-8').read()
        # No site os .glb são servidos de verdade (no artifact iam como texto base64).
        assert s.count('const PREVIA_TEXTO = true;') == 1, 'PREVIA_TEXTO não encontrado'
        s = s.replace('const PREVIA_TEXTO = true;', 'const PREVIA_TEXTO = false;')
        if not s.endswith('\n'):
            s += '\n'
        open(os.path.join(site, dst), 'w', encoding='utf-8').write(HEAD + s + '\n</body></html>\n')

# Confere se todo arquivo citado na página existe na pasta do site.
pagina = open(os.path.join(site, 'sofa-outlet.html'), encoding='utf-8').read()
citados = set(re.findall(r"(?:arquivo|arquivoFoto|foto|textura): '([^']+)'", pagina))
faltando = sorted(f for f in citados if not os.path.exists(os.path.join(site, f)))
if faltando:
    print('ATENÇÃO, faltam no site:', ', '.join(faltando))
print('ok: sofa-outlet.html e decorart.html gerados em', site)
