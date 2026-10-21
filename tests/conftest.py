from __future__ import annotations

from datetime import timedelta

import pytest
import yaml
from PIL import Image

from agente_instagram import config as config_mod
from agente_instagram.estado import Estado, agora_utc


@pytest.fixture
def raiz(tmp_path, monkeypatch):
    monkeypatch.setattr(config_mod, "RAIZ", tmp_path)
    for var in ("OPENAI_API_KEY", "IMAGENS_PROVEDOR", "META_ACCESS_TOKEN", "INSTAGRAM_USER_ID",
                "FACEBOOK_PAGE_ID", "META_AD_ACCOUNT_ID", "CLOUDINARY_CLOUD_NAME", "MODO_SIMULACAO",
                "MARCA_ARQUIVO"):
        monkeypatch.delenv(var, raising=False)
    (tmp_path / "produtos").mkdir()
    Image.new("RGB", (800, 1000), (40, 120, 200)).save(tmp_path / "produtos" / "vestido.jpg")
    return tmp_path


def escrever_marca(raiz, **extra):
    marca = yaml.safe_load(open(config_mod.Path(__file__).parent.parent / "marca.exemplo.yaml", encoding="utf-8"))
    marca["produtos"] = [
        {"nome": "Vestido Midi Floral", "preco": 189.9, "preco_promocional": 149.9, "fotos": ["produtos/vestido.jpg"]}
    ]
    marca["visual"]["logo"] = ""
    for chave, valor in extra.items():
        marca[chave] = {**marca.get(chave, {}), **valor} if isinstance(valor, dict) else valor
    caminho = raiz / "marca.yaml"
    caminho.write_text(yaml.safe_dump(marca, allow_unicode=True), encoding="utf-8")
    return caminho


@pytest.fixture
def cfg(raiz):
    c = config_mod.carregar(escrever_marca(raiz))
    c.pasta_dados = raiz / "dados"
    return c


@pytest.fixture
def estado(cfg):
    return Estado(cfg.pasta_dados)


def post_exemplo(formato="feed", **extra):
    base = {
        "formato": formato,
        "objetivo": "vender",
        "produto": "Vestido Midi Floral",
        "tema": "Vestido floral para o fim de semana",
        "titulo_arte": "Seu look de sábado chegou",
        "subtitulo_arte": "Viscose leve, do P ao GG 🌸",
        "chamada": "Peça pelo direct",
        "legenda": "Sábado pede leveza! 🌸\n\nChama no direct.",
        "hashtags": ["vestidofloral", "lookdodia"],
        "descricao_imagem": "a sunny street cafe",
        "slides": [],
        "cenas": [],
        "agendado_para": (agora_utc() + timedelta(hours=2)).isoformat(),
    }
    base.update(extra)
    return base


class GraphFalso:
    """Imita a Graph API guardando as chamadas."""

    def __init__(self, respostas_get=None):
        self.chamadas: list[tuple[str, str, dict]] = []
        self.respostas_get = respostas_get or {}
        self._n = 0

    def post(self, caminho, **dados):
        self.chamadas.append(("POST", caminho, dados))
        self._n += 1
        return {"id": f"id{self._n}"}

    def get(self, caminho, **params):
        self.chamadas.append(("GET", caminho, params))
        for chave, resposta in self.respostas_get.items():
            if chave in caminho:
                return resposta(params) if callable(resposta) else resposta
        if params.get("fields", "").startswith("status_code"):
            return {"status_code": "FINISHED"}
        if params.get("fields") == "permalink":
            return {"permalink": "https://instagram.com/p/abc"}
        return {"data": []}
