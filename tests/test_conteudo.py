from __future__ import annotations

import json
import shutil
import subprocess
from datetime import date, datetime, timedelta

import pytest
from PIL import Image

from agente_instagram.conteudo import planejador
from agente_instagram.conteudo.imagens import limpar_texto, texto_preco
from agente_instagram.conteudo.modelos import Cena, Plano, PostPlanejado, Slide
from agente_instagram.conteudo.produtor import produzir

from .conftest import post_exemplo

tem_ffmpeg = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="FFmpeg não instalado")


def test_vagas_respeitam_calendario(cfg, estado):
    inicio = date.today() + timedelta(days=1)
    vagas = planejador.calcular_vagas(cfg, estado, inicio, 7)
    formatos = [v.formato for v in vagas]
    assert formatos.count("reels") == 3
    assert formatos.count("feed") == 2
    assert formatos.count("carrossel") == 1
    assert formatos.count("story") == 5
    assert all(v.quando.strftime("%a") != "Sun" for v in vagas)  # domingo fora do calendário
    assert len({v.quando for v in vagas}) == len(vagas)
    assert vagas == sorted(vagas, key=lambda v: v.quando)


def test_vagas_pulam_horarios_ocupados(cfg, estado):
    inicio = date.today() + timedelta(days=1)
    primeira = planejador.calcular_vagas(cfg, estado, inicio, 7)
    for v in primeira:
        estado.adicionar_post(post_exemplo(v.formato, agendado_para=v.quando.isoformat()))
    segunda = planejador.calcular_vagas(cfg, estado, inicio, 7)
    assert not {v.quando for v in primeira} & {v.quando for v in segunda}


def _post_planejado(**extra):
    base = dict(
        objetivo="vender", produto="Vestido Midi Floral", tema="t", titulo_arte="Título",
        subtitulo_arte="", chamada="Chama no direct", legenda="Legenda", hashtags=["a"],
        descricao_imagem="scene", slides=[Slide(titulo="s", texto="t", descricao_imagem="")],
        cenas=[Cena(texto_na_tela="oi", descricao_imagem="x", usar_foto_produto=True, duracao_segundos=2)],
    )
    base.update(extra)
    return PostPlanejado(**base)


def test_planejar_coloca_posts_na_fila(cfg, estado, monkeypatch):
    vagas = planejador.calcular_vagas(cfg, estado, date.today() + timedelta(days=1), 7)
    recebido = {}

    def falso(**kwargs):
        recebido.update(kwargs)
        return Plano(estrategia="foco em reels", posts=[_post_planejado() for _ in vagas])

    monkeypatch.setattr(planejador, "gerar_estruturado", falso)
    novos = planejador.planejar(cfg, estado, vagas, briefing="promoção de primavera")

    assert len(novos) == len(vagas)
    assert recebido["formato"] is Plano
    texto = recebido["conteudo"][-1]["text"]
    assert "promoção de primavera" in texto and f"exatamente {len(vagas)} posts" in texto
    assert any(b.get("type") == "image" for b in recebido["conteudo"])  # foto real do produto vai junto
    for post, vaga in zip(novos, vagas):
        assert post["formato"] == vaga.formato
        assert datetime.fromisoformat(post["agendado_para"]) == vaga.quando
        assert (post["cenas"] != []) == (vaga.formato == "reels")
        assert (post["slides"] != []) == (vaga.formato == "carrossel")
    salvo = json.loads((cfg.pasta_dados / "estado.json").read_text(encoding="utf-8"))
    assert len(salvo["posts"]) == len(vagas)


def test_limpa_emoji_e_formata_preco():
    assert limpar_texto("Oferta 🔥 imperdível ✨") == "Oferta imperdível"
    assert texto_preco({"preco": 189.9, "preco_promocional": 1149.9}) == "R$ 1.149,90"
    assert texto_preco({"preco": "Consulte"}) == "Consulte"
    assert texto_preco(None) == ""


@pytest.mark.parametrize("formato,tamanho", [("feed", (1080, 1350)), ("story", (1080, 1920))])
def test_produz_imagem_sem_ia(cfg, estado, formato, tamanho):
    post = estado.adicionar_post(post_exemplo(formato))
    produzir(cfg, estado, post)
    assert post["status"] == "produzido", post.get("erro")
    assert Image.open(post["arquivos"][0]).size == tamanho
    assert post["urls"][0].startswith("file://")  # simulação sem hospedagem


def test_produz_carrossel(cfg, estado):
    slides = [{"titulo": f"Dica {i}", "texto": "Texto do slide", "descricao_imagem": ""} for i in range(4)]
    post = estado.adicionar_post(post_exemplo("carrossel", slides=slides))
    produzir(cfg, estado, post)
    assert post["status"] == "produzido", post.get("erro")
    assert len(post["arquivos"]) == 4
    assert all(Image.open(a).size == (1080, 1350) for a in post["arquivos"])


def test_aprovacao_obrigatoria(raiz):
    from agente_instagram import config as config_mod
    from agente_instagram.estado import Estado

    from .conftest import escrever_marca

    cfg = config_mod.carregar(escrever_marca(raiz, publicacao={"aprovar_antes_de_publicar": True}))
    cfg.pasta_dados = raiz / "dados"
    estado = Estado(cfg.pasta_dados)
    post = estado.adicionar_post(post_exemplo("feed"))
    produzir(cfg, estado, post)
    assert post["status"] == "aguardando_aprovacao"


@tem_ffmpeg
def test_produz_reels(cfg, estado):
    cenas = [
        {"texto_na_tela": "Gancho forte", "descricao_imagem": "", "usar_foto_produto": True, "duracao_segundos": 1.5},
        {"texto_na_tela": "Detalhe do tecido", "descricao_imagem": "", "usar_foto_produto": False, "duracao_segundos": 2},
        {"texto_na_tela": "Garanta o seu", "descricao_imagem": "", "usar_foto_produto": True, "duracao_segundos": 9},
    ]
    post = estado.adicionar_post(post_exemplo("reels", cenas=cenas))
    produzir(cfg, estado, post)
    assert post["status"] == "produzido", post.get("erro")
    assert post["capa_url"]
    info = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", post["arquivos"][0]],
        capture_output=True, text=True, check=True,
    ).stdout)
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    audio = next(s for s in info["streams"] if s["codec_type"] == "audio")
    assert (video["width"], video["height"]) == (1080, 1920)
    assert video["codec_name"] == "h264" and audio["codec_name"] == "aac"
    # 1.5 + 2 + 5 (a última cena é limitada a 5 s)
    assert abs(float(info["format"]["duration"]) - 8.5) < 0.3


def test_erro_na_producao_vai_para_a_fila(cfg, estado, monkeypatch):
    from agente_instagram.conteudo import produtor

    def quebra(*_a, **_k):
        raise RuntimeError("gerador fora do ar")

    monkeypatch.setattr(produtor, "imagem_base", quebra)
    post = estado.adicionar_post(post_exemplo("feed"))
    produzir(cfg, estado, post)
    assert post["status"] == "erro"
    assert "gerador fora do ar" in post["erro"]


def test_nao_refaz_post_publicado(cfg, estado):
    post = estado.adicionar_post(post_exemplo(status="publicado", urls=["https://cdn/a.jpg"]))
    produzir(cfg, estado, post)
    assert post["status"] == "publicado" and post["urls"] == ["https://cdn/a.jpg"]
