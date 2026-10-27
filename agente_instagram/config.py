"""Carrega a configuração do agente.

Segredos (chaves de API, tokens) vêm do arquivo `.env` ou das variáveis de
ambiente. Tudo o que descreve a loja (nome, produtos, cores, calendário,
limites de anúncios) vem do `marca.yaml`.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

RAIZ = Path(os.environ.get("AGENTE_RAIZ", Path.cwd()))


class ErroConfig(Exception):
    """Configuração ausente ou inválida."""


def carregar_env(caminho: Path | None = None) -> None:
    """Lê um arquivo .env simples (CHAVE=valor) sem sobrescrever o ambiente."""
    caminho = caminho or RAIZ / ".env"
    if not caminho.exists():
        return
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        valor = valor.strip().strip('"').strip("'")
        os.environ.setdefault(chave.strip(), valor)


def _env(nome: str, padrao: str = "") -> str:
    return os.environ.get(nome, padrao).strip()


def _bool(valor: Any) -> bool:
    if isinstance(valor, bool):
        return valor
    return str(valor).strip().lower() in {"1", "true", "sim", "yes", "s", "on"}


@dataclass
class ConfigMeta:
    token: str
    versao: str
    instagram_user_id: str
    pagina_id: str
    conta_anuncios_id: str

    @property
    def conta_anuncios(self) -> str:
        conta = self.conta_anuncios_id
        return conta if conta.startswith("act_") else f"act_{conta}"


@dataclass
class Config:
    marca: dict[str, Any]
    modelo_claude: str
    esforco_claude: str
    provedor_imagens: str
    openai_key: str
    openai_modelo_imagem: str
    meta: ConfigMeta
    midia_host: str
    cloudinary: dict[str, str]
    pasta_publica: str
    url_publica_base: str
    simulacao: bool
    pasta_dados: Path = field(default_factory=lambda: RAIZ / "dados")

    # --- atalhos para o marca.yaml ---
    @property
    def loja(self) -> dict[str, Any]:
        return self.marca.get("loja", {})

    @property
    def visual(self) -> dict[str, Any]:
        return self.marca.get("visual", {})

    @property
    def produtos(self) -> list[dict[str, Any]]:
        return self.marca.get("produtos", []) or []

    @property
    def calendario(self) -> dict[str, Any]:
        return self.marca.get("calendario", {})

    @property
    def publicacao(self) -> dict[str, Any]:
        return self.marca.get("publicacao", {})

    @property
    def reels(self) -> dict[str, Any]:
        return self.marca.get("reels", {})

    @property
    def anuncios(self) -> dict[str, Any]:
        return self.marca.get("anuncios", {})

    @property
    def fuso(self) -> str:
        return self.calendario.get("fuso", "America/Sao_Paulo")

    def caminho(self, relativo: str | None) -> Path | None:
        """Resolve um caminho do marca.yaml relativo à raiz do projeto."""
        if not relativo:
            return None
        p = Path(relativo)
        return p if p.is_absolute() else RAIZ / p

    def faltando_meta(self, *, anuncios: bool = False) -> list[str]:
        faltas = []
        if not self.meta.token:
            faltas.append("META_ACCESS_TOKEN")
        if not self.meta.instagram_user_id:
            faltas.append("INSTAGRAM_USER_ID")
        if anuncios:
            if not self.meta.conta_anuncios_id:
                faltas.append("META_AD_ACCOUNT_ID")
            if not self.meta.pagina_id:
                faltas.append("FACEBOOK_PAGE_ID")
        return faltas


def carregar(caminho_marca: Path | None = None) -> Config:
    carregar_env()
    caminho_marca = caminho_marca or Path(_env("MARCA_ARQUIVO", str(RAIZ / "marca.yaml")))
    if not caminho_marca.exists():
        raise ErroConfig(
            f"Não achei {caminho_marca}. Rode `python -m agente_instagram iniciar` "
            "e preencha o marca.yaml com os dados da sua loja."
        )
    marca = yaml.safe_load(caminho_marca.read_text(encoding="utf-8")) or {}

    openai_key = _env("OPENAI_API_KEY")
    provedor = _env("IMAGENS_PROVEDOR") or ("openai" if openai_key else "nenhum")

    return Config(
        marca=marca,
        modelo_claude=_env("CLAUDE_MODELO", "claude-opus-5-5"),
        esforco_claude=_env("CLAUDE_ESFORCO", "medium"),
        provedor_imagens=provedor,
        openai_key=openai_key,
        openai_modelo_imagem=_env("OPENAI_IMAGE_MODEL", "gpt-image-1"),
        meta=ConfigMeta(
            token=_env("META_ACCESS_TOKEN"),
            versao=_env("META_GRAPH_VERSION", "v23.0"),
            instagram_user_id=_env("INSTAGRAM_USER_ID"),
            pagina_id=_env("FACEBOOK_PAGE_ID"),
            conta_anuncios_id=_env("META_AD_ACCOUNT_ID"),
        ),
        midia_host=_env("MIDIA_HOST", "cloudinary"),
        cloudinary={
            "cloud_name": _env("CLOUDINARY_CLOUD_NAME"),
            "api_key": _env("CLOUDINARY_API_KEY"),
            "api_secret": _env("CLOUDINARY_API_SECRET"),
        },
        pasta_publica=_env("PASTA_PUBLICA"),
        url_publica_base=_env("URL_PUBLICA_BASE"),
        # Por segurança o padrão é simular: nada é publicado nem gasto até
        # você colocar MODO_SIMULACAO=false no .env.
        simulacao=_bool(_env("MODO_SIMULACAO", "true")),
    )
