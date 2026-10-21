"""Acesso ao Claude (Anthropic API)."""

from __future__ import annotations

import base64
import mimetypes
from functools import lru_cache
from pathlib import Path
from typing import TypeVar

import anthropic
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

# Se o modelo principal recusar um pedido, a API tenta de novo com um modelo
# reserva escolhido automaticamente, na mesma chamada.
BETAS_FALLBACK = ["server-side-fallback-2026-07-01"]


class ErroLLM(Exception):
    pass


@lru_cache(maxsize=1)
def cliente() -> anthropic.Anthropic:
    # Lê ANTHROPIC_API_KEY do ambiente.
    return anthropic.Anthropic()


def bloco_imagem(caminho: Path) -> dict:
    """Monta um bloco de imagem (foto de produto) para o Claude analisar."""
    tipo = mimetypes.guess_type(caminho.name)[0] or "image/jpeg"
    dados = base64.standard_b64encode(caminho.read_bytes()).decode("utf-8")
    return {"type": "image", "source": {"type": "base64", "media_type": tipo, "data": dados}}


def gerar_estruturado(
    *,
    modelo: str,
    sistema: str,
    conteudo: str | list[dict],
    formato: type[T],
    esforco: str = "medium",
    max_tokens: int = 64000,
) -> T:
    """Pede ao Claude uma resposta já validada no formato do modelo Pydantic."""
    with cliente().beta.messages.stream(
        model=modelo,
        max_tokens=max_tokens,
        system=sistema,
        messages=[{"role": "user", "content": conteudo}],
        output_format=formato,
        output_config={"effort": esforco},
        betas=BETAS_FALLBACK,
        fallbacks="default",
    ) as stream:
        resposta = stream.get_final_message()

    if resposta.stop_reason == "refusal":
        raise ErroLLM("O Claude recusou o pedido. Revise o tema/briefing e tente de novo.")
    if resposta.stop_reason == "max_tokens":
        raise ErroLLM("A resposta ficou grande demais e foi cortada. Peça menos posts por vez.")
    if resposta.parsed_output is None:
        raise ErroLLM("O Claude não devolveu uma resposta no formato esperado.")
    return resposta.parsed_output
