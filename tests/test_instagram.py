from __future__ import annotations

from datetime import timedelta

from agente_instagram.estado import agora_utc
from agente_instagram.instagram import metricas
from agente_instagram.instagram.graph import ErroMeta
from agente_instagram.instagram.publicador import montar_legenda, publicar, publicar_vencidos

from .conftest import GraphFalso, post_exemplo


def _real(cfg):
    cfg.simulacao = False
    cfg.meta.instagram_user_id = "17841"
    return cfg


def test_legenda_junta_hashtags_sem_repetir(cfg):
    post = post_exemplo(hashtags=["#ModaFeminina", "vestido floral"])
    legenda = montar_legenda(cfg, post)
    assert legenda.startswith("Sábado pede leveza!")
    assert legenda.endswith("#ModaFeminina #vestidofloral #minhaloja #campinas")


def test_legenda_respeita_limite(cfg):
    legenda = montar_legenda(cfg, post_exemplo(legenda="a" * 5000, hashtags=[f"t{i}" for i in range(40)]))
    assert len(legenda) <= 2200
    assert legenda.count("#") == 30


def test_simulacao_nao_chama_api(cfg, estado):
    post = estado.adicionar_post(post_exemplo(status="produzido", urls=["file:///x.jpg"]))
    publicar(cfg, estado, None, post)
    assert post["status"] == "publicado" and post["simulado"]


def test_publica_reels(cfg, estado):
    _real(cfg)
    graph = GraphFalso()
    post = estado.adicionar_post(post_exemplo(
        "reels", status="produzido", urls=["https://cdn/x/reels.mp4"], capa_url="https://cdn/x/capa.jpg"
    ))
    publicar(cfg, estado, graph, post)
    assert post["status"] == "publicado", post.get("erro")
    criar = graph.chamadas[0]
    assert criar[:2] == ("POST", "17841/media")
    assert criar[2]["media_type"] == "REELS" and criar[2]["video_url"].endswith(".mp4")
    assert criar[2]["cover_url"] == "https://cdn/x/capa.jpg"
    assert ("POST", "17841/media_publish", {"creation_id": "id1"}) in graph.chamadas
    assert post["permalink"] == "https://instagram.com/p/abc"


def test_publica_carrossel(cfg, estado):
    _real(cfg)
    graph = GraphFalso()
    urls = [f"https://cdn/x/slide_{i}.jpg" for i in range(3)]
    post = estado.adicionar_post(post_exemplo("carrossel", status="produzido", urls=urls))
    publicar(cfg, estado, graph, post)
    posts_media = [c for c in graph.chamadas if c[:2] == ("POST", "17841/media")]
    assert [c[2].get("is_carousel_item") for c in posts_media[:3]] == ["true"] * 3
    assert posts_media[3][2]["media_type"] == "CAROUSEL"
    assert posts_media[3][2]["children"] == "id1,id2,id3"
    assert post["status"] == "publicado"


def test_erro_da_meta_fica_registrado(cfg, estado):
    _real(cfg)

    class GraphComErro(GraphFalso):
        def post(self, caminho, **dados):
            raise ErroMeta("Token expirado", 190)

    post = estado.adicionar_post(post_exemplo(status="produzido", urls=["https://cdn/x.jpg"]))
    publicar(cfg, estado, GraphComErro(), post)
    assert post["status"] == "erro" and "Token expirado" in post["erro"]


def test_publica_so_os_vencidos(cfg, estado):
    passado = (agora_utc() - timedelta(minutes=5)).isoformat()
    futuro = (agora_utc() + timedelta(hours=5)).isoformat()
    a = estado.adicionar_post(post_exemplo(status="produzido", agendado_para=passado, urls=["file:///a"]))
    b = estado.adicionar_post(post_exemplo(status="produzido", agendado_para=futuro, urls=["file:///b"]))
    c = estado.adicionar_post(post_exemplo(status="planejado", agendado_para=passado))
    publicar_vencidos(cfg, estado, None)
    assert (a["status"], b["status"], c["status"]) == ("publicado", "produzido", "planejado")


def test_metricas_tira_metrica_nao_suportada(cfg, estado):
    pedidos = []

    def insights(params):
        pedidos.append(params["metric"])
        if "views" in params["metric"]:
            raise ErroMeta("metric not supported", 100)
        return {"data": [{"name": "reach", "values": [{"value": 500}]},
                         {"name": "total_interactions", "values": [{"value": 40}]}]}

    class G(GraphFalso):
        def get(self, caminho, **params):
            return insights(params)

    estado.adicionar_post(post_exemplo(status="publicado", ig_media_id="m1", publicado_em=agora_utc().isoformat()))
    atualizados = metricas.coletar(cfg, estado, G())
    assert len(pedidos) == 2
    assert atualizados[0]["metricas"]["alcance"] == 500
    assert metricas.taxa_engajamento(atualizados[0]) == 40 / 500


def test_rotina_segue_mesmo_se_planejamento_falhar(cfg, estado, monkeypatch):
    from agente_instagram import rotina

    def quebra(*_a, **_k):
        raise RuntimeError("API do Claude fora do ar")

    monkeypatch.setattr(rotina, "planejar_periodo", quebra)
    passado = (agora_utc() - timedelta(minutes=1)).isoformat()
    post = estado.adicionar_post(post_exemplo(status="produzido", agendado_para=passado, urls=["file:///a"]))
    mensagens = []
    assert rotina.rodar(cfg, estado, log=mensagens.append) is False
    assert post["status"] == "publicado"
    assert any("Erro na etapa planejar" in m for m in mensagens)
