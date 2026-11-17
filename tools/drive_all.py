# Lista e baixa (via servidor de imagens) as pastas públicas dos QR codes do catálogo.
import sys, os, json, re, subprocess, unicodedata, gdown
OUT = sys.argv[1]
PASTAS = {
 'valencia': '1-O8TdIFcr9wJS8YFD4DZLhp7oNGYD6Gd', 'istambul': '1IL9IMszl1FzyLv6DTqnAvWDN-xoKqfTG', 'parma': '1DL9Sl65xrQpc3hTFqMtJ9J6tlQnoOKoM',
 'paris': '1coFh-kwGPhV6viRcz16f2Z3Lmx7ykoaK', 'roma': '1boFXA444M8XipjfvwMeA-UQSvsz3zIRu', 'florenza': '1xxx9mz3-x2tVdZwfCT-6fHCTiuir3BPh',
 'mali': '1CBZYzWQGBI3wLaSS_GjqIAKq1mE0HMtG', 'ibiza': '1SABqUZO4Zg5SCygizVtAnZTtjFAly0uf', 'berlim': '1vMV2sd0Ay5A3GdPqgR_bFH-qLe9VyTRA',
 'versalhes': '1t-_xG9n0MBW8B3ouAXHToVQZpWYZH7PG', 'perola': '1tIEZvI4Zj1iCLNtZiNsj4n5oIjSJk3as', 'agata': '18roI5nSKhzwSlWPrd_GiH8sblgJPIlL7',
 'topazio': '14xo-rXqmp33Q7bmG9VgUSoUbVSLRq33X', 'rubi': '1iSBYhofcxwTAleqYXB7MAG9kCWz2HrTA', 'puff-belle': '1Wb19SwuugaXH_9hpzrynbEA1ahbzAMtL',
 'doha': '1GQoiJcecxxebuYQCXodiUJMNeb9brpz-',
 'lazio': '1J0jVDHaMTN75qGGj0911Rx0F3wI5Akll', 'tokio': '195W8NyrEPGGa5_7gq4Gul0rTZVk_tayr', 'tokio-poltrona': '1fTT17IsIy6pmnR2_hkEDa8YhQIZhAGtH',
 'melissa': '1ATGQ5F3rq47ZIlJLqIXtAiHAUAd17siE', 'safira': '1iIWQfoCp24lhdFi7RUxF-bNztGhBF-9p', 'italia': '1fEItE2dEd8fUmXjbcxaKIFLkVMbl-r2P',
 'dalian': '14AkAOlgcYhDterV7shQCjd2HyixQcCgn',
}
only = sys.argv[2:]
def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-zA-Z0-9.]+', '-', s).strip('-').lower()
index = {}
for nome, fid in PASTAS.items():
    if only and nome not in only: continue
    d = os.path.join(OUT, nome); os.makedirs(d, exist_ok=True)
    try:
        files = gdown.download_folder(url=f'https://drive.google.com/drive/folders/{fid}', skip_download=True, quiet=True)
    except Exception as e:
        print(nome, 'ERRO ao listar:', str(e)[:120]); continue
    lst = []
    for f in files:
        ext = os.path.splitext(f.path)[1].lower()
        name = slug(f.path.replace('/', '__'))
        dest = os.path.join(d, name)
        if ext in ('.jpg', '.jpeg', '.png', '.webp'):
            if not os.path.exists(dest) or os.path.getsize(dest) < 1000:
                r = subprocess.run(['curl', '-sSL', '-m', '120', '-o', dest, '-w', '%{http_code}', f'https://lh3.googleusercontent.com/d/{f.id}=s0'], capture_output=True, text=True)
                ok = r.stdout.strip() == '200'
            else: ok = True
            lst.append({'path': f.path, 'file': name if ok else None, 'bytes': os.path.getsize(dest) if ok and os.path.exists(dest) else 0})
        else:
            lst.append({'path': f.path, 'file': None, 'bytes': 0, 'nota': 'não é imagem'})
    index[nome] = lst
    print(nome.ljust(15), len(lst), 'arquivos:', '; '.join(x['path'] for x in lst)[:300], flush=True)
json.dump(index, open(os.path.join(OUT, '_indice.json'), 'w'), ensure_ascii=False, indent=1)
