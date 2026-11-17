# Gera a página de cada loja a partir da base (mesmos produtos, tecidos e 3D),
# trocando identidade visual, cabeçalho e WhatsApp.
# Uso: python3 lojas.py <base.html> <saida-sofa-outlet.html> <saida-decorart.html>
import sys, re

base_path, out_sofa, out_deco = sys.argv[1:4]
base = open(base_path, encoding='utf-8').read()

def tokens(layout, light, dark, display):
    def block(d):
        return ' '.join(f'--{k}: {v};' for k, v in d.items())
    return f"""/* Layout: palco 3D grande + ficha do produto ao lado (desktop) ou abaixo (celular). {layout} A trena amarela marca as medidas reais. */
:root {{
  {block(light)}
  --tape: #fbba00; --tape-ink: #1a1400;
  --good: #23704a; --warn: #93600f; --bad: #a8352a;
  --shadow: 0 1px 2px rgb(40 30 20 / 0.07), 0 8px 24px rgb(40 30 20 / 0.08);
  --font-display: {display};
  --font-body: "Figtree", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --r-lg: 20px;
  --r-md: 12px;
  --r-sm: 8px;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    {block(dark)}
    --good: #66c891; --warn: #e5a84e; --bad: #f08176;
    --shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px rgb(0 0 0 / 0.3);
    color-scheme: dark;
  }}
}}
:root[data-theme="dark"] {{
  {block(dark)}
  --good: #66c891; --warn: #e5a84e; --bad: #f08176;
  --shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px rgb(0 0 0 / 0.3);
  color-scheme: dark;
}}

"""

LOJAS = {
  'sofa': dict(
    title='Provador 3D Sofá Outlet',
    fonts='family=Playfair+Display:wght@600;700&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600',
    display='"Playfair Display", Georgia, "Times New Roman", serif',
    layout='Identidade Sofá Outlet: creme e marrom da logo; no escuro, preto e dourado dos posts.',
    light={'bg': '#f7f3e8', 'surface': '#fffdf6', 'ink': '#2e302b', 'muted': '#6b665a', 'line': '#e3dbc9',
           'brand': '#87603a', 'brand-ink': '#fffaf0', 'accent': '#87603a', 'accent-ink': '#fffaf0', 'accent-soft': '#f1e6d2',
           'stage-a': '#fffef8', 'stage-b': '#ebe3d1'},
    dark={'bg': '#121110', 'surface': '#1c1a17', 'ink': '#f3ede0', 'muted': '#aaa292', 'line': '#342f28',
          'brand': '#c9a35a', 'brand-ink': '#17130b', 'accent': '#d4b06a', 'accent-ink': '#17130b', 'accent-soft': '#2e2617',
          'stage-a': '#2b2823', 'stage-b': '#151412'},
    header='''    <div class="store">
      <img class="store-logo" src="loja-sofa-outlet.png" alt="Sofá Outlet" width="250" height="250">
      <div class="store-txt">
        <b>Sofá Outlet</b>
        <span>Loja de fábrica · Provador 3D</span>
      </div>
    </div>''',
    loja="const LOJA = { nome: 'Sofá Outlet', whatsapp: '5583921454788' }; // WhatsApp com DDI e DDD, só dígitos: +55 (83) 92145-4788",
    store_css='''.store b { font: 700 clamp(24px, 2.8vw, 32px)/1.05 var(--font-display); letter-spacing: 0.005em; }''',
  ),
  'deco': dict(
    title='Provador 3D Decorart Ambientes',
    fonts='family=Montserrat:wght@500;600;700&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600',
    display='"Montserrat", "Helvetica Neue", Arial, sans-serif',
    layout='Identidade Decorart Ambientes: os marrons do "D", madeira e preto; no escuro, preto com caramelo.',
    light={'bg': '#f6f4f1', 'surface': '#ffffff', 'ink': '#1b1814', 'muted': '#6a6157', 'line': '#e4ddd4',
           'brand': '#1b1814', 'brand-ink': '#f3e6d4', 'accent': '#5e3a1b', 'accent-ink': '#ffffff', 'accent-soft': '#f1e8dd',
           'stage-a': '#ffffff', 'stage-b': '#e7e2db'},
    dark={'bg': '#111010', 'surface': '#1b1918', 'ink': '#f2ece4', 'muted': '#a99e92', 'line': '#332e2a',
          'brand': '#c19d73', 'brand-ink': '#1b1209', 'accent': '#d3b38c', 'accent-ink': '#1b1209', 'accent-soft': '#2c2219',
          'stage-a': '#2a2725', 'stage-b': '#141312'},
    header='''    <div class="store">
      <img class="store-logo mark-light" src="loja-decorart-marca.png" alt="" width="177" height="136">
      <img class="store-logo mark-dark" src="loja-decorart.png" alt="" width="250" height="250">
      <div class="store-txt" aria-label="Decorart Ambientes">
        <b>Decorart</b>
        <span>Ambientes · Provador 3D</span>
      </div>
    </div>''',
    loja="const LOJA = { nome: 'Decorart Ambientes', whatsapp: '5583998799800' }; // WhatsApp com DDI e DDD, só dígitos: +55 (83) 99879-9800",
    store_css='''.store b { font: 700 clamp(24px, 2.8vw, 32px)/1 var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; }''',
  ),
}

STORE_CSS_OLD = re.compile(r"\.store \{ display: flex; flex-direction: column; gap: 2px; min-width: 0; \}\n\.store b \{[^\n]*\}\n\.store span \{[^\n]*\}\n")
COMMON_STORE_CSS = '''.store { display: flex; align-items: center; gap: 12px; min-width: 0; }
.store-logo { display: block; height: 62px; width: auto; flex: none; }
.store-logo[src$="loja-sofa-outlet.png"], .mark-dark { border-radius: 50%; box-shadow: 0 0 0 1px var(--line); }
.mark-dark { display: none; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .mark-light { display: none; } :root:not([data-theme="light"]) .mark-dark { display: block; } }
:root[data-theme="dark"] .mark-light { display: none; }
:root[data-theme="dark"] .mark-dark { display: block; }
.store-txt { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
%s
.store span { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
'''
MOBILE_OLD = "@media (max-width: 520px) { .logo { height: 40px; } .brand small { display: none; } .store b { font-size: 24px; } .store span { font-size: 10.5px; } }"
MOBILE_NEW = "@media (max-width: 520px) { .logo { height: 36px; } .brand small { display: none; } .store { gap: 9px; } .store-logo { height: 46px; } .store b { font-size: 20px; } .store span { font-size: 10px; letter-spacing: 0.05em; } }"

def build(cfg):
    s = base
    s = re.sub(r'^<title>[^<]*</title>', f'<title>{cfg["title"]}</title>', s, count=1)
    s, n = re.subn(r'(fonts\.googleapis\.com/css2\?)[^"&]*(?:&family=[^"&]*)*(&display=swap)', lambda m: m.group(1) + cfg['fonts'] + m.group(2), s, count=1); assert n == 1, 'fontes'
    i = s.index('/* Layout: palco 3D'); j = s.index('* { box-sizing: border-box; }')
    s = s[:i] + tokens(cfg['layout'], cfg['light'], cfg['dark'], cfg['display']) + s[j:]
    s, n = STORE_CSS_OLD.subn(lambda m: COMMON_STORE_CSS.replace('%s', cfg['store_css']), s, count=1); assert n == 1, 'css do topo'
    assert MOBILE_OLD in s; s = s.replace(MOBILE_OLD, MOBILE_NEW, 1)
    i = s.index('    <div class="store">'); j = s.index('    <div class="brand"')
    s = s[:i] + cfg['header'] + '\n' + s[j:]
    s, n = re.subn(r"^const LOJA = \{[^\n]*$", cfg['loja'], s, count=1, flags=re.M); assert n == 1, 'LOJA'
    s = s.replace("$('lojaNome').textContent = LOJA.nome;\n", '')
    assert 'lojaNome' not in s
    return s

open(out_sofa, 'w', encoding='utf-8').write(build(LOJAS['sofa']))
open(out_deco, 'w', encoding='utf-8').write(build(LOJAS['deco']))
print('ok')
