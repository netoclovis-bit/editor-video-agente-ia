"""Coloca as imagens e vídeos num endereço público.

A API do Instagram não recebe o arquivo direto: ela baixa a mídia de uma URL
pública. Por isso cada arte gerada é enviada para um serviço de hospedagem.
"""

from __future__ import annotations

import hashlib
import shutil
import time
from pathlib import Path

import requests

from .config import Config

PASTA_CLOUDINARY = "agente-instagram"


class ErroHospedagem(Exception):
    pass


def _cloudinary(cfg: Config, arquivo: Path) -> str:
    c = cfg.cloudinary
    tipo = "video" if arquivo.suffix.lower() in {".mp4", ".mov"} else "image"
    carimbo = str(int(time.time()))
    # Assinatura: parâmetros em ordem alfabética + segredo, em SHA-1.
    assinar = f"folder={PASTA_CLOUDINARY}&timestamp={carimbo}{c['api_secret']}"
    with arquivo.open("rb") as arq:
        resp = requests.post(
            f"https://api.cloudinary.com/v1_1/{c['cloud_name']}/{tipo}/upload",
            data={
                "api_key": c["api_key"],
                "timestamp": carimbo,
                "folder": PASTA_CLOUDINARY,
                "signature": hashlib.sha1(assinar.encode()).hexdigest(),
            },
            files={"file": arq},
            timeout=600,
        )
    if resp.status_code != 200:
        raise ErroHospedagem(f"Cloudinary respondeu {resp.status_code}: {resp.text[:300]}")
    return resp.json()["secure_url"]


def _pasta_publica(cfg: Config, arquivo: Path, nome: str) -> str:
    destino = Path(cfg.pasta_publica) / nome
    destino.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(arquivo, destino)
    return f"{cfg.url_publica_base.rstrip('/')}/{nome}"


def configurado(cfg: Config) -> bool:
    if cfg.midia_host == "cloudinary":
        return all(cfg.cloudinary.values())
    if cfg.midia_host == "pasta_publica":
        return bool(cfg.pasta_publica and cfg.url_publica_base)
    return False


def enviar(cfg: Config, arquivo: Path, nome: str) -> str:
    """Devolve a URL pública do arquivo. `nome` é usado como caminho no destino."""
    if not configurado(cfg):
        if cfg.simulacao:
            # Simulando: nada vai ser publicado, então o arquivo local basta.
            return arquivo.resolve().as_uri()
        raise ErroHospedagem(
            "Hospedagem de mídia não configurada. Preencha CLOUDINARY_* (ou PASTA_PUBLICA e "
            "URL_PUBLICA_BASE) no .env."
        )
    if cfg.midia_host == "cloudinary":
        return _cloudinary(cfg, arquivo)
    return _pasta_publica(cfg, arquivo, nome)
