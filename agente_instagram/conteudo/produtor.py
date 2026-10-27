"""Transforma um post planejado em arquivos prontos (imagens, carrossel ou reels)."""

from __future__ import annotations

from pathlib import Path

from .. import midia_host
from ..config import Config
from ..estado import Estado
from .imagens import TAMANHOS, camada_texto, compor, imagem_base, salvar_jpg, texto_preco
from .reels import CenaPronta, montar_reels


def achar_produto(cfg: Config, nome: str) -> dict | None:
    nome = (nome or "").strip().lower()
    if not nome:
        return None
    for p in cfg.produtos:
        if p.get("nome", "").strip().lower() == nome:
            return p
    return None


def _foto(cfg: Config, produto: dict | None) -> Path | None:
    fotos = (produto or {}).get("fotos") or []
    caminho = cfg.caminho(fotos[0]) if fotos else None
    return caminho if caminho and caminho.exists() else None


def _arte(cfg, tamanho, descricao, foto, titulo, subtitulo, chamada, preco):
    base = imagem_base(cfg, descricao, tamanho, foto)
    return base, camada_texto(cfg, tamanho, titulo, subtitulo, chamada, preco)


def gerar_arquivos(cfg: Config, post: dict) -> tuple[list[Path], Path | None]:
    """Gera os arquivos do post. Devolve (arquivos, capa_do_reels)."""
    pasta = cfg.pasta_dados / "midia" / post["id"]
    produto = achar_produto(cfg, post.get("produto", ""))
    foto = _foto(cfg, produto)
    preco = texto_preco(produto) if post.get("objetivo") == "vender" else ""
    formato = post["formato"]
    tamanho = TAMANHOS[formato]

    if formato in ("feed", "story"):
        base, texto = _arte(
            cfg, tamanho, post["descricao_imagem"], foto,
            post["titulo_arte"], post.get("subtitulo_arte", ""), post.get("chamada", ""), preco,
        )
        return [salvar_jpg(compor(base, texto), pasta / "post.jpg")], None

    if formato == "carrossel":
        slides = post.get("slides") or []
        if len(slides) < 2:
            slides = [
                {"titulo": post["titulo_arte"], "texto": post.get("subtitulo_arte", ""), "descricao_imagem": post["descricao_imagem"]},
                {"titulo": post.get("chamada") or "Fale com a gente", "texto": "", "descricao_imagem": ""},
            ]
        arquivos = []
        for i, slide in enumerate(slides[:10]):
            primeiro, ultimo = i == 0, i == len(slides) - 1
            base, texto = _arte(
                cfg, tamanho, slide.get("descricao_imagem", ""), foto if primeiro else None,
                slide["titulo"], slide.get("texto", ""),
                post.get("chamada", "") if ultimo else "",
                preco if primeiro else "",
            )
            arquivos.append(salvar_jpg(compor(base, texto), pasta / f"slide_{i + 1:02d}.jpg"))
        return arquivos, None

    # reels
    cenas_planejadas = post.get("cenas") or [
        {"texto_na_tela": post["titulo_arte"], "descricao_imagem": post["descricao_imagem"], "usar_foto_produto": True, "duracao_segundos": 4}
    ]
    duracao_padrao = float(cfg.reels.get("duracao_cena", 3.0))
    cenas = []
    for i, cena in enumerate(cenas_planejadas):
        ultima = i == len(cenas_planejadas) - 1
        base, texto = _arte(
            cfg, tamanho, cena.get("descricao_imagem", ""), foto if cena.get("usar_foto_produto") else None,
            cena.get("texto_na_tela", ""), "",
            post.get("chamada", "") if ultima else "",
            preco if ultima else "",
        )
        duracao = min(max(float(cena.get("duracao_segundos") or duracao_padrao), 1.5), 5.0)
        cenas.append(CenaPronta(fundo=base, texto=texto, duracao=duracao))

    capa = salvar_jpg(compor(cenas[0].fundo, cenas[0].texto), pasta / "capa.jpg")
    musica = cfg.caminho(cfg.reels.get("musica"))
    video = montar_reels(cenas, pasta / "reels.mp4", musica)
    return [video], capa


def produzir(cfg: Config, estado: Estado, post: dict) -> dict:
    """Gera e hospeda a mídia do post; atualiza o status na fila."""
    if post["status"] in ("publicado", "cancelado"):
        return post  # refazer a arte de um post publicado faria ele sair de novo
    try:
        arquivos, capa = gerar_arquivos(cfg, post)
        post["arquivos"] = [str(a) for a in arquivos]
        post["urls"] = [midia_host.enviar(cfg, a, f"{post['id']}/{a.name}") for a in arquivos]
        post["capa_url"] = midia_host.enviar(cfg, capa, f"{post['id']}/{capa.name}") if capa else ""
        aprovar = bool(cfg.publicacao.get("aprovar_antes_de_publicar", False))
        post["status"] = "aguardando_aprovacao" if aprovar else "produzido"
        post.pop("erro", None)
        estado.registrar("produzido", post=post["id"], formato=post["formato"])
    except Exception as erro:  # noqa: BLE001 - qualquer falha vira status de erro na fila
        post["status"] = "erro"
        post["erro"] = f"Produção: {erro}"
        estado.registrar("erro_producao", post=post["id"], erro=str(erro))
    estado.salvar()
    return post
