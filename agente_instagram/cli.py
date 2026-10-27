"""Linha de comando: python -m agente_instagram <comando>."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import anthropic

from . import config as config_mod
from . import midia_host
from .anuncios.gestor import Bloqueado, GestorAnuncios
from .config import RAIZ, ErroConfig
from .conteudo.imagens import ErroImagem
from .conteudo.reels import ErroVideo
from .estado import Estado
from .instagram.graph import ErroMeta, GraphAPI
from .llm import ErroLLM
from .midia_host import ErroHospedagem

MODELOS = Path(__file__).resolve().parent.parent


def _carregar():
    try:
        cfg = config_mod.carregar()
    except ErroConfig as erro:
        sys.exit(str(erro))
    return cfg, Estado(cfg.pasta_dados)


def cmd_iniciar(_args) -> None:
    for modelo, destino in (("marca.exemplo.yaml", "marca.yaml"), (".env.exemplo", ".env")):
        alvo = RAIZ / destino
        if alvo.exists():
            print(f"{destino} já existe, mantive o seu.")
        else:
            shutil.copy(MODELOS / modelo, alvo)
            print(f"Criei {destino}. Abra e preencha.")
    for pasta in ("produtos", "marca", "dados"):
        (RAIZ / pasta).mkdir(exist_ok=True)
    print("Coloque as fotos dos produtos em produtos/ e o logo em marca/. Depois: python -m agente_instagram verificar")


def cmd_verificar(_args) -> None:
    cfg, _ = _carregar()
    ok = lambda b: "OK " if b else "-- "  # noqa: E731
    import os

    print(f"{ok(bool(os.environ.get('ANTHROPIC_API_KEY')))}Claude (ANTHROPIC_API_KEY) — modelo {cfg.modelo_claude}")
    print(f"{ok(cfg.provedor_imagens == 'openai')}Imagens com IA ({cfg.provedor_imagens}); sem IA usa a foto do produto")
    print(f"{ok(shutil.which('ffmpeg') is not None)}FFmpeg (para reels)")
    print(f"{ok(midia_host.configurado(cfg))}Hospedagem de mídia ({cfg.midia_host})")
    print(f"{ok(bool(cfg.produtos))}{len(cfg.produtos)} produto(s) no marca.yaml")
    for p in cfg.produtos:
        for foto in p.get("fotos") or []:
            if not cfg.caminho(foto).exists():
                print(f"-- Foto não encontrada: {foto} ({p.get('nome')})")
    faltando = cfg.faltando_meta()
    print(f"{ok(not faltando)}Instagram {'(faltam ' + ', '.join(faltando) + ')' if faltando else ''}")
    if not faltando:
        try:
            conta = GraphAPI(cfg.meta).get(cfg.meta.instagram_user_id, fields="username,followers_count,media_count")
            print(f"    Conectado a @{conta.get('username')} — {conta.get('followers_count')} seguidores")
        except ErroMeta as erro:
            print(f"-- Erro ao acessar o Instagram: {erro}")
    if cfg.anuncios.get("ativo"):
        faltando = cfg.faltando_meta(anuncios=True)
        print(f"{ok(not faltando)}Anúncios {'(faltam ' + ', '.join(faltando) + ')' if faltando else ''}")
    print(f"\nModo simulação: {'LIGADO (nada é publicado nem gasto)' if cfg.simulacao else 'desligado'}")


def cmd_descobrir(_args) -> None:
    """Lista Páginas, contas do Instagram e contas de anúncio que o token enxerga."""
    cfg, _ = _carregar()
    if not cfg.meta.token:
        sys.exit("Preencha META_ACCESS_TOKEN no .env primeiro (veja docs/CONFIGURAR.md).")
    graph = GraphAPI(cfg.meta)
    try:
        paginas = graph.get("me/accounts", fields="id,name,instagram_business_account{id,username}").get("data", [])
        contas = graph.get("me/adaccounts", fields="id,name,currency,account_status").get("data", [])
    except ErroMeta as erro:
        sys.exit(f"A Meta recusou o token: {erro}")
    if not paginas:
        print("Nenhuma Página encontrada. Confira se o token tem acesso à Página da loja.")
    for pg in paginas:
        ig = pg.get("instagram_business_account") or {}
        print(f"Página '{pg['name']}'\n  FACEBOOK_PAGE_ID={pg['id']}")
        if ig:
            print(f"  INSTAGRAM_USER_ID={ig['id']}   (@{ig.get('username', '')})")
        else:
            print("  (sem conta do Instagram profissional vinculada)")
    for conta in contas:
        ativa = "ativa" if conta.get("account_status") == 1 else f"status {conta.get('account_status')}"
        print(f"Conta de anúncios '{conta.get('name')}' ({conta.get('currency')}, {ativa})\n  META_AD_ACCOUNT_ID={conta['id']}")


def cmd_planejar(args) -> None:
    from .conteudo.planejador import planejar_periodo

    cfg, estado = _carregar()
    novos = planejar_periodo(cfg, estado, dias=args.dias, briefing=args.briefing or "")
    print(f"{len(novos)} posts planejados:")
    _listar(cfg, novos)


def cmd_produzir(args) -> None:
    from .conteudo.produtor import produzir

    cfg, estado = _carregar()
    alvos = [estado.post(args.id)] if args.id else list(estado.por_status("planejado"))
    for p in alvos:
        print(f"Produzindo {p['id']} ({p['formato']})...")
        produzir(cfg, estado, p)
        print(f"  {p['status']} {p.get('erro', '')} {' '.join(p.get('arquivos', []))}")


def cmd_fila(args) -> None:
    cfg, estado = _carregar()
    status = ["planejado", "produzido", "aguardando_aprovacao", "erro"] + (["publicado"] if args.todos else [])
    _listar(cfg, sorted(estado.por_status(*status), key=lambda p: p["agendado_para"]))


def cmd_aprovar(args) -> None:
    cfg, estado = _carregar()
    post = estado.post(args.id)
    if post["status"] != "aguardando_aprovacao":
        sys.exit(f"O post está '{post['status']}'.")
    post["status"] = "produzido"
    estado.salvar()
    print(f"Post {args.id} aprovado; sai no horário marcado.")


def cmd_publicar(args) -> None:
    from .instagram.publicador import publicar, publicar_vencidos
    from .rotina import graph_ou_nada

    cfg, estado = _carregar()
    graph = graph_ou_nada(cfg)
    if args.id:
        post = estado.post(args.id)
        if post["status"] == "publicado" and not post.get("simulado"):
            sys.exit(f"O post {args.id} já está no ar: {post.get('permalink', '')}")
        if not post.get("urls"):
            from .conteudo.produtor import produzir

            produzir(cfg, estado, post)
            if post["status"] == "erro":
                sys.exit(post["erro"])
        posts = [publicar(cfg, estado, graph, post)]
    else:
        posts = publicar_vencidos(cfg, estado, graph)
    for p in posts:
        print(f"{p['id']}: {p['status']} {p.get('permalink', '')} {p.get('erro', '')}")
    if not posts:
        print("Nenhum post na hora de publicar.")


def cmd_metricas(_args) -> None:
    from .instagram.metricas import coletar, taxa_engajamento

    cfg, estado = _carregar()
    if cfg.faltando_meta():
        sys.exit(f"Faltam {', '.join(cfg.faltando_meta())} no .env.")
    posts = sorted(coletar(cfg, estado, GraphAPI(cfg.meta)), key=taxa_engajamento, reverse=True)
    for p in posts:
        m = p["metricas"]
        print(f"{p['id']} [{p['formato']}] {p['tema'][:40]:40} alcance {m.get('alcance', 0):>6}  "
              f"interações {m.get('interacoes', 0):>5}  engajamento {taxa_engajamento(p):.1%}")


def cmd_rotina(_args) -> None:
    from .rotina import rodar

    cfg, estado = _carregar()
    if not rodar(cfg, estado):
        sys.exit(1)


def cmd_agente(args) -> None:
    from .agente import Agente

    cfg, estado = _carregar()
    agente = Agente(cfg, estado)
    if args.mensagem:
        agente.conversar(" ".join(args.mensagem))
        return
    print("Converse com o agente do seu Instagram (sair: Ctrl+C ou 'sair').")
    while True:
        try:
            texto = input("\nVocê: ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if texto.lower() in {"sair", "exit", "quit"}:
            break
        if texto:
            agente.conversar(texto)


def cmd_anuncios(args) -> None:
    from .rotina import graph_ou_nada

    cfg, estado = _carregar()
    if not cfg.simulacao and cfg.faltando_meta(anuncios=True):
        sys.exit(f"Faltam {', '.join(cfg.faltando_meta(anuncios=True))} no .env.")
    gestor = GestorAnuncios(cfg, estado, graph_ou_nada(cfg))
    try:
        if args.acao == "status":
            resultado = gestor.resumo()
        elif args.acao == "impulsionar":
            resultado = gestor.impulsionar(args.id, args.orcamento, args.dias)
        elif args.acao == "aprovar":
            resultado = gestor.aprovar(args.id)
        elif args.acao == "pausar":
            resultado = gestor.pausar(args.id)
        else:
            resultado = {"acoes": gestor.otimizar()}
    except (Bloqueado, ErroMeta, KeyError) as erro:
        sys.exit(f"Não fiz: {erro}")
    print(json.dumps(resultado, ensure_ascii=False, indent=2, default=str))


def _listar(cfg, posts) -> None:
    tz = ZoneInfo(cfg.fuso)
    for p in posts:
        quando = datetime.fromisoformat(p["agendado_para"]).astimezone(tz)
        print(f"{p['id']}  {quando:%d/%m %H:%M}  {p['formato']:9} {p['status']:21} {p.get('tema', '')[:60]}"
              + (f"\n          erro: {p['erro']}" if p.get("erro") else ""))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="agente_instagram", description="Agente de IA para o Instagram da loja")
    sub = parser.add_subparsers(dest="comando", required=True)

    sub.add_parser("iniciar", help="cria marca.yaml e .env a partir dos exemplos").set_defaults(f=cmd_iniciar)
    sub.add_parser("verificar", help="confere chaves, FFmpeg e conexão com o Instagram").set_defaults(f=cmd_verificar)
    sub.add_parser("descobrir", help="mostra os ids da Página, do Instagram e da conta de anúncios").set_defaults(f=cmd_descobrir)

    p = sub.add_parser("planejar", help="planeja os próximos dias de conteúdo")
    p.add_argument("--dias", type=int, default=7)
    p.add_argument("--briefing", help="pedido especial, ex.: 'promoção de Natal'")
    p.set_defaults(f=cmd_planejar)

    p = sub.add_parser("produzir", help="gera artes e reels dos posts planejados")
    p.add_argument("--id")
    p.set_defaults(f=cmd_produzir)

    p = sub.add_parser("fila", help="mostra a fila de posts")
    p.add_argument("--todos", action="store_true", help="inclui os já publicados")
    p.set_defaults(f=cmd_fila)

    p = sub.add_parser("aprovar", help="aprova um post (quando aprovar_antes_de_publicar: true)")
    p.add_argument("id")
    p.set_defaults(f=cmd_aprovar)

    p = sub.add_parser("publicar", help="publica os posts que chegaram no horário (ou um específico)")
    p.add_argument("--id")
    p.set_defaults(f=cmd_publicar)

    sub.add_parser("metricas", help="atualiza e mostra os resultados dos posts").set_defaults(f=cmd_metricas)
    sub.add_parser("rotina", help="faz tudo: publica, planeja, produz, mede e cuida dos anúncios").set_defaults(f=cmd_rotina)

    p = sub.add_parser("agente", help="converse com o agente (ou passe um pedido direto)")
    p.add_argument("mensagem", nargs="*")
    p.set_defaults(f=cmd_agente)

    p = sub.add_parser("anuncios", help="tráfego pago")
    p.add_argument("acao", choices=["status", "impulsionar", "aprovar", "pausar", "otimizar"])
    p.add_argument("id", nargs="?", help="id do post (impulsionar) ou da campanha (aprovar/pausar)")
    p.add_argument("--orcamento", type=float, help="reais por dia")
    p.add_argument("--dias", type=int)
    p.set_defaults(f=cmd_anuncios)

    args = parser.parse_args(argv)
    if args.comando == "anuncios" and args.acao in ("impulsionar", "aprovar", "pausar") and not args.id:
        parser.error(f"anuncios {args.acao} precisa de um id")
    try:
        args.f(args)
    except (ErroLLM, ErroImagem, ErroVideo, ErroHospedagem) as erro:
        sys.exit(str(erro))
    except anthropic.AuthenticationError:
        sys.exit("A chave do Claude foi recusada. Confira ANTHROPIC_API_KEY no .env.")
    except TypeError as erro:
        if "authentication" not in str(erro):
            raise
        sys.exit("Falta a chave do Claude: preencha ANTHROPIC_API_KEY no .env.")
