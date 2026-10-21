from __future__ import annotations

from datetime import timedelta

import pytest

from agente_instagram import config as config_mod
from agente_instagram.anuncios.gestor import Bloqueado, GestorAnuncios
from agente_instagram.estado import Estado, agora_utc
from agente_instagram.instagram.graph import ErroMeta

from .conftest import GraphFalso, escrever_marca, post_exemplo

LIMITES = {
    "ativo": True,
    "orcamento_diario_padrao": 15,
    "orcamento_diario_max": 25,
    "orcamento_diario_total_max": 40,
    "orcamento_mensal_max": 2000,
}


def montar(raiz, real=False, gasto_mes=0.0, insights=None, **anuncios):
    cfg = config_mod.carregar(escrever_marca(raiz, anuncios={**LIMITES, **anuncios}))
    cfg.pasta_dados = raiz / "dados"
    estado = Estado(cfg.pasta_dados)
    graph = None
    if real:
        cfg.simulacao = False
        cfg.meta.instagram_user_id = "17841"
        cfg.meta.pagina_id = "pg1"
        cfg.meta.conta_anuncios_id = "123"
        respostas = {"act_123/insights": {"data": [{"spend": str(gasto_mes)}]}}
        if insights:
            respostas["/insights"] = {"data": [insights]}
        graph = GraphFalso(respostas)
    return cfg, estado, graph, GestorAnuncios(cfg, estado, graph)


def publicado(estado, **extra):
    return estado.adicionar_post(post_exemplo(
        status="publicado", ig_media_id="m1", publicado_em=agora_utc().isoformat(), **extra
    ))


def test_desligado_nao_cria_nada(raiz):
    _, estado, _, gestor = montar(raiz, ativo=False)
    post = publicado(estado)
    with pytest.raises(Bloqueado, match="desligados"):
        gestor.impulsionar(post["id"])
    assert estado.campanhas == []


def test_nasce_aguardando_aprovacao_e_respeita_teto(raiz):
    _, estado, _, gestor = montar(raiz)
    c = gestor.impulsionar(publicado(estado)["id"], orcamento_diario=999)
    assert c["status"] == "AGUARDANDO_APROVACAO"
    assert c["orcamento_diario"] == 25  # cortado no máximo por campanha


def test_nao_impulsiona_post_nao_publicado_nem_duas_vezes(raiz):
    _, estado, _, gestor = montar(raiz)
    rascunho = estado.adicionar_post(post_exemplo(status="produzido"))
    with pytest.raises(Bloqueado, match="publicado"):
        gestor.impulsionar(rascunho["id"])
    post = publicado(estado)
    gestor.impulsionar(post["id"])
    with pytest.raises(Bloqueado, match="em andamento"):
        gestor.impulsionar(post["id"])


def test_total_diario_bloqueia_aprovacao(raiz):
    _, estado, _, gestor = montar(raiz)
    ids = [gestor.impulsionar(publicado(estado)["id"], orcamento_diario=20)["campanha_id"] for _ in range(3)]
    gestor.aprovar(ids[0])
    gestor.aprovar(ids[1])  # 40/dia: no limite
    with pytest.raises(Bloqueado, match="limite é R\\$ 40"):
        gestor.aprovar(ids[2])


def test_limite_mensal_projetado(raiz):
    _, estado, _, gestor = montar(raiz, real=True, gasto_mes=590, orcamento_mensal_max=600)
    with pytest.raises(Bloqueado, match="limite mensal"):
        gestor.impulsionar(publicado(estado)["id"], orcamento_diario=10, dias=7)


def test_cria_campanha_completa_na_meta(raiz):
    _, estado, graph, gestor = montar(raiz, real=True, objetivo="trafego", link_destino="https://loja.com/x")
    c = gestor.impulsionar(publicado(estado)["id"], orcamento_diario=12.5, dias=5)
    posts = {caminho: dados for metodo, caminho, dados in graph.chamadas if metodo == "POST"}
    campanha = posts["act_123/campaigns"]
    assert campanha["status"] == "PAUSED"
    assert campanha["daily_budget"] == 1250
    assert campanha["objective"] == "OUTCOME_TRAFFIC"
    conjunto = posts["act_123/adsets"]
    assert conjunto["optimization_goal"] == "LINK_CLICKS"
    assert conjunto["targeting"]["publisher_platforms"] == ["instagram"]
    assert conjunto["targeting"]["genders"] == [2]
    criativo = posts["act_123/adcreatives"]
    assert criativo["source_instagram_media_id"] == "m1"
    assert criativo["call_to_action"]["value"]["link"] == "https://loja.com/x"
    assert posts["act_123/ads"]["creative"] == {"creative_id": c["criativo_id"]}
    assert c["status"] == "AGUARDANDO_APROVACAO"


def test_ativacao_automatica_liga_a_campanha(raiz):
    _, estado, graph, gestor = montar(raiz, real=True, ativar_automaticamente=True)
    c = gestor.impulsionar(publicado(estado)["id"])
    campanha = next(d for m, cam, d in graph.chamadas if cam == "act_123/campaigns")
    assert campanha["status"] == "ACTIVE" and c["status"] == "ATIVA"


def _ativa(estado, orcamento=10.0):
    registro = {
        "campanha_id": f"c{len(estado.campanhas)}", "post_id": "p", "objetivo": "engajamento",
        "orcamento_diario": orcamento, "dias": 7, "status": "ATIVA", "simulado": False,
        "termina_em": (agora_utc() + timedelta(days=5)).isoformat(), "criado_em": agora_utc().isoformat(),
    }
    estado.campanhas.append(registro)
    return registro


def test_otimizador_pausa_campanha_cara(raiz):
    _, estado, graph, gestor = montar(raiz, real=True, insights={"spend": "30", "clicks": "10", "cpc": "3.0", "ctr": "1.2"})
    c = _ativa(estado)
    acoes = gestor.otimizar()
    assert c["status"] == "PAUSADA" and "CPC" in acoes[0]
    assert ("POST", c["campanha_id"], {"status": "PAUSED"}) in graph.chamadas


def test_otimizador_escala_campanha_boa_ate_o_teto(raiz):
    _, estado, graph, gestor = montar(raiz, real=True, insights={"spend": "30", "clicks": "100", "cpc": "0.3", "ctr": "2.5"})
    c = _ativa(estado, orcamento=22)
    gestor.otimizar()
    assert c["orcamento_diario"] == 25  # 22 + 20% = 26.4, limitado a 25
    assert ("POST", c["campanha_id"], {"daily_budget": 2500}) in graph.chamadas


def test_otimizador_espera_gasto_minimo(raiz):
    _, estado, graph, gestor = montar(raiz, real=True, insights={"spend": "3", "clicks": "1", "cpc": "3.0", "ctr": "0.1"})
    c = _ativa(estado)
    assert gestor.otimizar() == []
    assert c["status"] == "ATIVA"


def test_limite_mensal_atingido_pausa_tudo(raiz):
    _, estado, _, gestor = montar(raiz, real=True, gasto_mes=2000)
    a, b = _ativa(estado), _ativa(estado)
    gestor.otimizar()
    assert a["status"] == b["status"] == "PAUSADA"


def test_impulsiona_melhor_post_da_semana(raiz):
    _, estado, _, gestor = montar(raiz, impulsionar_top_posts_por_semana=1)
    fraco = publicado(estado, metricas={"alcance": 1000, "interacoes": 10})
    forte = publicado(estado, metricas={"alcance": 800, "interacoes": 120})
    publicado(estado, metricas={"alcance": 50, "interacoes": 40})  # alcance abaixo do mínimo
    criadas = gestor.impulsionar_melhores()
    assert [c["post_id"] for c in criadas] == [forte["id"]]
    assert gestor.impulsionar_melhores() == []  # já usou a vaga da semana
    assert fraco["id"] not in {c["post_id"] for c in estado.campanhas}


def test_falha_na_meta_nao_repete_toda_hora(raiz):
    _, estado, graph, gestor = montar(raiz, real=True, impulsionar_top_posts_por_semana=1)

    def falha(caminho, **dados):
        graph.chamadas.append(("POST", caminho, dados))
        if caminho.endswith("/adcreatives"):
            raise ErroMeta("Conta do Instagram sem permissão de anúncio", 10)
        return {"id": f"id{len(graph.chamadas)}"}

    graph.post = falha
    publicado(estado, metricas={"alcance": 800, "interacoes": 120})
    assert gestor.impulsionar_melhores() == []
    assert [c["status"] for c in estado.campanhas] == ["ERRO"]
    pausas = [c for c in graph.chamadas if c[2] == {"status": "PAUSED"}]
    assert len(pausas) == 1  # a campanha criada pela metade foi pausada
    n = len(graph.chamadas)
    assert gestor.impulsionar_melhores() == []  # na hora seguinte não tenta de novo
    assert len(graph.chamadas) == n
