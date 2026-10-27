"""Rotina automática: rode de hora em hora (cron ou GitHub Actions) e o Instagram anda sozinho."""

from __future__ import annotations

import traceback
from datetime import datetime, timedelta

from .anuncios.gestor import Bloqueado, GestorAnuncios
from .config import Config
from .conteudo.planejador import planejar_periodo
from .conteudo.produtor import produzir
from .estado import Estado, agora_utc
from .instagram.graph import ErroMeta, GraphAPI
from .instagram.metricas import coletar
from .instagram.publicador import publicar_vencidos


def graph_ou_nada(cfg: Config) -> GraphAPI | None:
    if cfg.simulacao and not cfg.meta.token:
        return None
    return GraphAPI(cfg.meta)


def _publicar(cfg: Config, estado: Estado, graph, log) -> None:
    faltando = [] if cfg.simulacao else cfg.faltando_meta()
    if faltando:
        log(f"Não vou publicar: faltam {', '.join(faltando)} no .env.")
        return
    for p in publicar_vencidos(cfg, estado, graph):
        log(f"Post {p['id']} ({p['formato']}): {p['status']} {p.get('permalink', '')} {p.get('erro', '')}")


def _planejar(cfg: Config, estado: Estado, log) -> None:
    antecedencia = int(cfg.calendario.get("planejar_com_antecedencia_dias", 3))
    pendentes = estado.pendentes_futuros()
    ultimo = max((datetime.fromisoformat(p["agendado_para"]) for p in pendentes), default=agora_utc())
    if ultimo < agora_utc() + timedelta(days=antecedencia):
        novos = planejar_periodo(cfg, estado, dias=7)
        log(f"Planejei {len(novos)} posts novos.")


def _produzir(cfg: Config, estado: Estado, log) -> None:
    limite = agora_utc() + timedelta(hours=48)
    for p in list(estado.por_status("planejado")):
        if datetime.fromisoformat(p["agendado_para"]) <= limite:
            produzir(cfg, estado, p)
            log(f"Produzi {p['id']} ({p['formato']}): {p['status']} {p.get('erro', '')}")


def _metricas(cfg: Config, estado: Estado, graph, log) -> None:
    ultima = estado.dados.get("metricas_coletadas_em")
    if not graph or cfg.simulacao:
        return
    if ultima and datetime.fromisoformat(ultima) > agora_utc() - timedelta(hours=20):
        return
    atualizados = coletar(cfg, estado, graph)
    estado.dados["metricas_coletadas_em"] = agora_utc().isoformat()
    log(f"Métricas atualizadas de {len(atualizados)} posts.")


def _anuncios(cfg: Config, estado: Estado, graph, log) -> None:
    if not cfg.anuncios.get("ativo"):
        return
    if not cfg.simulacao and cfg.faltando_meta(anuncios=True):
        log(f"Anúncios ligados, mas faltam: {', '.join(cfg.faltando_meta(anuncios=True))}")
        return
    gestor = GestorAnuncios(cfg, estado, graph)
    try:
        for acao in gestor.otimizar():
            log(f"Anúncios: {acao}")
        for c in gestor.impulsionar_melhores():
            log(
                f"Anúncios: criei a campanha {c['campanha_id']} (post {c['post_id']}, "
                f"R$ {c['orcamento_diario']:.2f}/dia) — status {c['status']}"
            )
    except (Bloqueado, ErroMeta) as erro:
        log(f"Anúncios: {erro}")


def rodar(cfg: Config, estado: Estado, log=print) -> bool:
    """Executa todas as etapas; uma etapa com erro não impede as outras. Devolve True se tudo deu certo."""
    graph = graph_ou_nada(cfg)
    if cfg.simulacao:
        log("Modo simulação: nada será publicado nem gasto (MODO_SIMULACAO=true).")

    etapas = [
        ("publicar", lambda: _publicar(cfg, estado, graph, log)),
        ("planejar", lambda: _planejar(cfg, estado, log)),
        ("produzir", lambda: _produzir(cfg, estado, log)),
        ("métricas", lambda: _metricas(cfg, estado, graph, log)),
        ("anúncios", lambda: _anuncios(cfg, estado, graph, log)),
    ]
    tudo_certo = True
    for nome, etapa in etapas:
        try:
            etapa()
        except Exception as erro:  # noqa: BLE001 - registra e segue para a próxima etapa
            tudo_certo = False
            log(f"Erro na etapa {nome}: {erro}")
            estado.registrar("erro_rotina", etapa=nome, erro=str(erro), detalhe=traceback.format_exc()[-1500:])
    estado.salvar()
    return tudo_certo
