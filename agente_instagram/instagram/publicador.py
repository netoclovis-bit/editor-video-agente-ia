"""Publica posts, carrosséis, reels e stories pela API oficial do Instagram."""

from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path

from .. import midia_host
from ..config import Config
from ..estado import Estado, agora_utc
from ..midia_host import ErroHospedagem
from .graph import ErroMeta, GraphAPI

LIMITE_LEGENDA = 2200
LIMITE_HASHTAGS = 30


def montar_legenda(cfg: Config, post: dict) -> str:
    tags = []
    for t in [*post.get("hashtags", []), *cfg.marca.get("hashtags_base", [])]:
        t = "#" + str(t).lstrip("#").replace(" ", "")
        if t.lower() not in {x.lower() for x in tags}:
            tags.append(t)
    tags = tags[:LIMITE_HASHTAGS]
    texto = post.get("legenda", "").strip()
    rodape = " ".join(tags)
    espaco = LIMITE_LEGENDA - len(rodape) - 2
    if len(texto) > espaco:
        texto = texto[: espaco - 1].rstrip() + "…"
    return f"{texto}\n\n{rodape}".strip()


def aguardar_container(graph: GraphAPI, container_id: str, limite_s: int = 600, intervalo_s: int = 5) -> None:
    """O Instagram processa a mídia antes de publicar; vídeos podem levar alguns minutos."""
    inicio = time.monotonic()
    while True:
        status = graph.get(container_id, fields="status_code,status").get("status_code")
        if status in ("FINISHED", "PUBLISHED"):
            return
        if status in ("ERROR", "EXPIRED"):
            detalhe = graph.get(container_id, fields="status").get("status", "")
            raise ErroMeta(f"O Instagram não conseguiu processar a mídia ({status}): {detalhe}")
        if time.monotonic() - inicio > limite_s:
            raise ErroMeta("Tempo esgotado esperando o Instagram processar a mídia.")
        time.sleep(intervalo_s)


def _container(graph: GraphAPI, ig: str, url: str, **extra) -> str:
    chave = "video_url" if url.lower().split("?")[0].endswith((".mp4", ".mov")) else "image_url"
    return graph.post(f"{ig}/media", **{chave: url}, **extra)["id"]


def criar_container(cfg: Config, graph: GraphAPI, post: dict) -> str:
    ig = cfg.meta.instagram_user_id
    urls = post["urls"]
    legenda = montar_legenda(cfg, post)
    formato = post["formato"]

    if formato == "feed":
        return _container(graph, ig, urls[0], caption=legenda)
    if formato == "story":
        return _container(graph, ig, urls[0], media_type="STORIES")
    if formato == "reels":
        return graph.post(
            f"{ig}/media",
            media_type="REELS",
            video_url=urls[0],
            caption=legenda,
            share_to_feed="true",
            cover_url=post.get("capa_url") or None,
        )["id"]
    # carrossel
    filhos = []
    for url in urls[:10]:
        filho = _container(graph, ig, url, is_carousel_item="true")
        aguardar_container(graph, filho, limite_s=300)
        filhos.append(filho)
    return graph.post(f"{ig}/media", media_type="CAROUSEL", children=",".join(filhos), caption=legenda)["id"]


def publicar(cfg: Config, estado: Estado, graph: GraphAPI | None, post: dict) -> dict:
    if cfg.simulacao:
        post["status"] = "publicado"
        post["simulado"] = True
        post["publicado_em"] = agora_utc().isoformat()
        estado.registrar("publicacao_simulada", post=post["id"])
        estado.salvar()
        return post
    if graph is None:
        raise ValueError("GraphAPI é obrigatória fora do modo simulação")
    try:
        # Mídia produzida durante a simulação ainda não está num endereço público.
        if any(not u.startswith("https://") for u in post.get("urls", [])):
            post["urls"] = [midia_host.enviar(cfg, Path(a), f"{post['id']}/{Path(a).name}") for a in post["arquivos"]]
            capa = Path(post["arquivos"][0]).with_name("capa.jpg")
            post["capa_url"] = midia_host.enviar(cfg, capa, f"{post['id']}/capa.jpg") if capa.exists() else ""
        container = criar_container(cfg, graph, post)
        aguardar_container(graph, container)
        media_id = graph.post(f"{cfg.meta.instagram_user_id}/media_publish", creation_id=container)["id"]
        post["ig_media_id"] = media_id
        post["permalink"] = graph.get(media_id, fields="permalink").get("permalink", "")
        post["status"] = "publicado"
        post["publicado_em"] = agora_utc().isoformat()
        post.pop("erro", None)
        estado.registrar("publicado", post=post["id"], ig_media_id=media_id)
    except (ErroMeta, ErroHospedagem, OSError) as erro:
        post["status"] = "erro"
        post["erro"] = f"Publicação: {erro}"
        estado.registrar("erro_publicacao", post=post["id"], erro=str(erro))
    estado.salvar()
    return post


def publicar_vencidos(cfg: Config, estado: Estado, graph: GraphAPI | None) -> list[dict]:
    """Publica todo post produzido cujo horário já chegou."""
    agora = agora_utc()
    vencidos = [
        p for p in estado.por_status("produzido") if datetime.fromisoformat(p["agendado_para"]) <= agora
    ]
    return [publicar(cfg, estado, graph, p) for p in sorted(vencidos, key=lambda p: p["agendado_para"])]
