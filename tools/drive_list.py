# Lista os arquivos de uma pasta pública do Google Drive (id, caminho) sem baixar.
import sys, json, gdown
url = sys.argv[1]
files = gdown.download_folder(url=url, skip_download=True, quiet=True)
print(json.dumps([{'id': f.id, 'path': f.path} for f in files], ensure_ascii=False))
