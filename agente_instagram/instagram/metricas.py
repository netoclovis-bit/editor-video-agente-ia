"""Coleta os resultados dos posts publicados (alcance, curtidas, salvamentos...)."""

from __future__ import annotations

from datetime import datetime, timedelta

from ..config import Config
from ..estado import Estado, agora_utc
from .graph import ErroMeta, GraphAPI

# Nome na API -> nome guardado na fila.
METRICAS = {
    "reach": "alcance",
    "likes": "curtidas",
    "comments": "comentarios",
    "saved": "salvamentos",
    "shares": "compartilhamentos",
    "total_interactions": "interacoes",
    "views": "visualizacoes",
}
METRICAS_STORY = {"reach": "alcance", "replies": "respostas", "views": "visualizacoes"}


def _ler(graph: GraphAPI, media_id: str, metricas: dict[str, str]) -> dict[str, int]:
    nomes = list(metricas)
    while nomes:
        try:
            resp = graph.get(f"{media_id}/insights", metric=",".join(nomes))
            break
        except ErroMeta as erro:
            # Métrica não suportada para este tipo de mídia: tira a última e tenta de novo.
            if erro.codigo != 100 or len(nomes) == 1:
                raise
            nomes.pop()
    else:
        return {}
    saida = {}
    for item in resp.get("data", []):
        valores = item.get("values") or [{}]
        saida[metricas.get(item["name"], item["name"])] = int(valores[0].get("value", 0) or 0)
    return saida


def coletar(cfg: Config, estado: Estado, graph: GraphAPI, dias: int = 30) -> list[dict]:
    limite = agora_utc() - timedelta(days=dias)
    atualizados = []
    for post in estado.por_status("publicado"):
        if not post.get("ig_media_id") or datetime.fromisoformat(post["publicado_em"]) < limite:
            continue
        # Métricas de story só existem nas primeiras 24 horas.
        if post["formato"] == "story" and datetime.fromisoformat(post["publicado_em"]) < agora_utc() - timedelta(hours=24):
            continue
        try:
            metricas = METRICAS_STORY if post["formato"] == "story" else METRICAS
            post["metricas"] = {**post.get("metricas", {}), **_ler(graph, post["ig_media_id"], metricas)}
            post["metricas"]["atualizado_em"] = agora_utc().isoformat()
            atualizados.append(post)
        except ErroMeta as erro:
            estado.registrar("erro_metricas", post=post["id"], erro=str(erro))
    estado.salvar()
    return atualizados


def taxa_engajamento(post: dict) -> float:
    m = post.get("metricas", {})
    return m.get("interacoes", 0) / max(m.get("alcance", 0), 1)
