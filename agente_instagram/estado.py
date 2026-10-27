"""Fila de posts e histórico de anúncios, guardados em dados/estado.json."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

# Ciclo de vida de um post:
#   planejado -> produzido -> (aguardando_aprovacao) -> publicado
#                     \-> erro (com a mensagem em post["erro"])
STATUS = ("planejado", "produzido", "aguardando_aprovacao", "publicado", "erro", "cancelado")


def agora_utc() -> datetime:
    return datetime.now(timezone.utc)


def novo_id() -> str:
    return uuid.uuid4().hex[:8]


class Estado:
    def __init__(self, pasta: Path):
        self.pasta = pasta
        self.arquivo = pasta / "estado.json"
        self.dados: dict[str, Any] = {"posts": [], "campanhas": [], "log": []}
        if self.arquivo.exists():
            self.dados.update(json.loads(self.arquivo.read_text(encoding="utf-8")))

    def salvar(self) -> None:
        self.pasta.mkdir(parents=True, exist_ok=True)
        tmp = self.arquivo.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.dados, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self.arquivo)

    # --- posts ---
    @property
    def posts(self) -> list[dict[str, Any]]:
        return self.dados["posts"]

    def adicionar_post(self, post: dict[str, Any]) -> dict[str, Any]:
        post.setdefault("id", novo_id())
        post.setdefault("status", "planejado")
        post.setdefault("criado_em", agora_utc().isoformat())
        self.posts.append(post)
        return post

    def post(self, post_id: str) -> dict[str, Any]:
        for p in self.posts:
            if p["id"] == post_id:
                return p
        raise KeyError(f"Post {post_id} não encontrado")

    def por_status(self, *status: str) -> Iterator[dict[str, Any]]:
        return (p for p in self.posts if p["status"] in status)

    def pendentes_futuros(self) -> list[dict[str, Any]]:
        agora = agora_utc()
        return [
            p
            for p in self.por_status("planejado", "produzido", "aguardando_aprovacao")
            if datetime.fromisoformat(p["agendado_para"]) >= agora
        ]

    # --- campanhas de anúncio ---
    @property
    def campanhas(self) -> list[dict[str, Any]]:
        return self.dados["campanhas"]

    def campanha(self, campanha_id: str) -> dict[str, Any]:
        for c in self.campanhas:
            if c["campanha_id"] == campanha_id:
                return c
        raise KeyError(f"Campanha {campanha_id} não encontrada")

    # --- log ---
    def registrar(self, evento: str, **detalhes: Any) -> None:
        self.dados["log"].append({"quando": agora_utc().isoformat(), "evento": evento, **detalhes})
        # Mantém o arquivo pequeno.
        self.dados["log"] = self.dados["log"][-500:]
