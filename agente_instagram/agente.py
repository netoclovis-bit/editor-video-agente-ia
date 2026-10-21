"""Agente de IA que cuida do Instagram da loja: você conversa e ele executa."""

from __future__ import annotations

import json
from datetime import datetime
from zoneinfo import ZoneInfo

from anthropic import beta_tool

from .anuncios.gestor import Bloqueado, GestorAnuncios
from .config import Config
from .conteudo.planejador import Vaga, planejar, planejar_periodo
from .conteudo.produtor import produzir
from .estado import Estado
from .instagram.graph import ErroMeta
from .instagram.metricas import coletar, taxa_engajamento
from .instagram.publicador import publicar
from .llm import BETAS_FALLBACK, cliente
from .rotina import graph_ou_nada

CAMPOS_ARTE = {"titulo_arte", "subtitulo_arte", "chamada", "descricao_imagem"}
CAMPOS_EDITAVEIS = CAMPOS_ARTE | {"legenda", "tema", "hashtags"}


def _sistema(cfg: Config) -> str:
    agora = datetime.now(ZoneInfo(cfg.fuso))
    return f"""\
Você é o agente de IA que cuida do Instagram da loja "{cfg.loja.get('nome', 'da loja')}" \
({cfg.loja.get('instagram', '')}). O dono da loja conversa com você em português.

Você tem ferramentas para: ver a fila de posts, planejar conteúdo, criar posts avulsos
(feed, carrossel, reels, story), gerar as artes e vídeos, publicar, reagendar, editar,
ver resultados e cuidar do tráfego pago (impulsionar posts dentro dos limites do marca.yaml).

Como trabalhar:
- Quando o pedido for claro, faça. Pergunte só quando faltar algo que só o dono sabe
  (por exemplo, o preço de uma promoção que não está no catálogo).
- Datas e horários estão no fuso {cfg.fuso}. Agora é {agora:%A, %d/%m/%Y %H:%M}.
- Ao terminar, responda em poucas linhas: o que foi feito, ids dos posts e próximos passos.
- Tráfego pago: as ferramentas já aplicam os limites de orçamento. Campanhas criadas
  ficam esperando aprovação, a não ser que o marca.yaml diga o contrário. Você não pode
  ligar uma campanha pausada: diga ao dono para rodar `python -m agente_instagram anuncios
  aprovar <id>`.
- Modo simulação está {"LIGADO: nada é publicado nem gasto de verdade" if cfg.simulacao else "desligado: as ações são reais"}.
"""


def _resumo_post(p: dict) -> dict:
    return {
        "id": p["id"],
        "formato": p["formato"],
        "quando": p["agendado_para"][:16],
        "status": p["status"],
        "tema": p.get("tema"),
        "produto": p.get("produto"),
        "titulo_arte": p.get("titulo_arte"),
        "arquivos": p.get("arquivos", []),
        "link": p.get("permalink", ""),
        "erro": p.get("erro", ""),
        "metricas": p.get("metricas", {}),
    }


def criar_ferramentas(cfg: Config, estado: Estado) -> list:
    tz = ZoneInfo(cfg.fuso)
    graph = graph_ou_nada(cfg)

    def responder(dados) -> str:
        return json.dumps(dados, ensure_ascii=False, default=str)

    def data_local(texto: str) -> datetime:
        return datetime.strptime(texto.strip(), "%Y-%m-%d %H:%M").replace(tzinfo=tz)

    @beta_tool
    def ver_fila(incluir_publicados: bool = False) -> str:
        """Lista os posts planejados, produzidos, com erro e (opcionalmente) os já publicados.

        Args:
            incluir_publicados: true para incluir também os posts já publicados.
        """
        status = ["planejado", "produzido", "aguardando_aprovacao", "erro"]
        if incluir_publicados:
            status.append("publicado")
        posts = sorted(estado.por_status(*status), key=lambda p: p["agendado_para"])
        return responder([_resumo_post(p) for p in posts])

    @beta_tool
    def planejar_conteudo(dias: int = 7, briefing: str = "") -> str:
        """Planeja os próximos dias de conteúdo seguindo o calendário do marca.yaml.

        Args:
            dias: Quantos dias planejar (1 a 31).
            briefing: Pedido especial do dono, ex.: 'foco na promoção de Dia das Mães'.
        """
        novos = planejar_periodo(cfg, estado, dias=max(1, min(dias, 31)), briefing=briefing)
        return responder({"criados": [_resumo_post(p) for p in novos]})

    @beta_tool
    def criar_post(formato: str, quando: str, briefing: str) -> str:
        """Cria um post avulso e coloca na fila (ainda sem gerar a arte).

        Args:
            formato: feed, carrossel, reels ou story.
            quando: Data e hora de publicação no formato 'AAAA-MM-DD HH:MM'.
            briefing: O que o post deve comunicar, com todos os detalhes que o dono passou.
        """
        if formato not in ("feed", "carrossel", "reels", "story"):
            return responder({"erro": "formato deve ser feed, carrossel, reels ou story"})
        novos = planejar(cfg, estado, [Vaga(data_local(quando), formato)], briefing=briefing)
        return responder({"criados": [_resumo_post(p) for p in novos]})

    @beta_tool
    def produzir_post(post_id: str) -> str:
        """Gera a arte (imagens ou vídeo do reels) de um post planejado e hospeda os arquivos.

        Args:
            post_id: Id do post na fila.
        """
        return responder(_resumo_post(produzir(cfg, estado, estado.post(post_id))))

    @beta_tool
    def publicar_agora(post_id: str) -> str:
        """Publica o post imediatamente (gera a arte antes, se ainda não tiver).

        Args:
            post_id: Id do post na fila.
        """
        post = estado.post(post_id)
        if post["status"] == "publicado" and not post.get("simulado"):
            return responder({"erro": "este post já está no ar", "link": post.get("permalink", "")})
        if post["status"] == "cancelado":
            return responder({"erro": "este post foi cancelado"})
        if post["status"] in ("planejado", "erro") and not post.get("urls"):
            produzir(cfg, estado, post)
            if post["status"] == "erro":
                return responder(_resumo_post(post))
        post["agendado_para"] = datetime.now(tz).isoformat()
        return responder(_resumo_post(publicar(cfg, estado, graph, post)))

    @beta_tool
    def aprovar_post(post_id: str) -> str:
        """Aprova um post que está aguardando aprovação; ele será publicado no horário marcado.

        Args:
            post_id: Id do post na fila.
        """
        post = estado.post(post_id)
        if post["status"] != "aguardando_aprovacao":
            return responder({"erro": f"o post está '{post['status']}', não aguardando aprovação"})
        post["status"] = "produzido"
        estado.salvar()
        return responder(_resumo_post(post))

    @beta_tool
    def reagendar_post(post_id: str, quando: str) -> str:
        """Muda a data e hora de publicação de um post.

        Args:
            post_id: Id do post na fila.
            quando: Nova data e hora no formato 'AAAA-MM-DD HH:MM'.
        """
        post = estado.post(post_id)
        post["agendado_para"] = data_local(quando).isoformat()
        if post["status"] == "erro":
            post["status"] = "produzido" if post.get("urls") else "planejado"
        estado.salvar()
        return responder(_resumo_post(post))

    @beta_tool
    def editar_post(post_id: str, campo: str, valor: str) -> str:
        """Altera um campo de um post que ainda não foi publicado.

        Se o campo muda a arte (titulo_arte, subtitulo_arte, chamada, descricao_imagem),
        o post volta para 'planejado' e a arte é gerada de novo.

        Args:
            post_id: Id do post na fila.
            campo: legenda, tema, hashtags, titulo_arte, subtitulo_arte, chamada ou descricao_imagem.
            valor: Novo valor. Para hashtags, separe por vírgula.
        """
        post = estado.post(post_id)
        if post["status"] == "publicado":
            return responder({"erro": "post já publicado; edite direto no Instagram"})
        if campo not in CAMPOS_EDITAVEIS:
            return responder({"erro": f"campo deve ser um de: {', '.join(sorted(CAMPOS_EDITAVEIS))}"})
        post[campo] = [h.strip().lstrip("#") for h in valor.split(",") if h.strip()] if campo == "hashtags" else valor
        if campo in CAMPOS_ARTE:
            post["status"] = "planejado"
            post["urls"] = []
        estado.salvar()
        return responder(_resumo_post(post))

    @beta_tool
    def cancelar_post(post_id: str) -> str:
        """Tira um post da fila (não apaga posts já publicados).

        Args:
            post_id: Id do post na fila.
        """
        post = estado.post(post_id)
        if post["status"] == "publicado":
            return responder({"erro": "post já publicado; apague direto no Instagram se quiser"})
        post["status"] = "cancelado"
        estado.salvar()
        return responder(_resumo_post(post))

    @beta_tool
    def ver_resultados(atualizar: bool = True) -> str:
        """Mostra os resultados dos posts publicados, do melhor para o pior engajamento.

        Args:
            atualizar: true para buscar números novos no Instagram antes.
        """
        if atualizar and graph and not cfg.simulacao:
            coletar(cfg, estado, graph)
        publicados = sorted(estado.por_status("publicado"), key=taxa_engajamento, reverse=True)
        return responder([_resumo_post(p) for p in publicados[:20]])

    @beta_tool
    def resumo_anuncios() -> str:
        """Mostra gasto do mês, limites de orçamento e as campanhas criadas pelo agente."""
        return responder(GestorAnuncios(cfg, estado, graph).resumo())

    @beta_tool
    def impulsionar_post(post_id: str, orcamento_diario: float = 0, dias: int = 0) -> str:
        """Cria uma campanha para impulsionar um post publicado, respeitando os limites do marca.yaml.

        Args:
            post_id: Id do post publicado.
            orcamento_diario: Reais por dia; 0 usa o padrão do marca.yaml.
            dias: Duração em dias; 0 usa o padrão do marca.yaml.
        """
        try:
            c = GestorAnuncios(cfg, estado, graph).impulsionar(post_id, orcamento_diario or None, dias or None)
        except (Bloqueado, ErroMeta) as erro:
            return responder({"bloqueado": str(erro)})
        return responder(c)

    @beta_tool
    def pausar_campanha(campanha_id: str) -> str:
        """Pausa uma campanha de anúncio criada pelo agente.

        Args:
            campanha_id: Id da campanha.
        """
        return responder(GestorAnuncios(cfg, estado, graph).pausar(campanha_id, "pedido do dono no chat"))

    @beta_tool
    def otimizar_anuncios() -> str:
        """Aplica as regras de otimização do marca.yaml: pausa campanhas ruins e escala as boas."""
        try:
            return responder({"acoes": GestorAnuncios(cfg, estado, graph).otimizar()})
        except (Bloqueado, ErroMeta) as erro:
            return responder({"erro": str(erro)})

    return [
        ver_fila, planejar_conteudo, criar_post, produzir_post, publicar_agora, aprovar_post,
        reagendar_post, editar_post, cancelar_post, ver_resultados, resumo_anuncios,
        impulsionar_post, pausar_campanha, otimizar_anuncios,
    ]


class Agente:
    def __init__(self, cfg: Config, estado: Estado):
        self.cfg = cfg
        self.estado = estado
        self.ferramentas = criar_ferramentas(cfg, estado)
        self.sistema = _sistema(cfg)
        self.historico: list = []

    def conversar(self, mensagem: str, mostrar=print) -> None:
        self.historico.append({"role": "user", "content": mensagem})
        runner = cliente().beta.messages.tool_runner(
            model=self.cfg.modelo_claude,
            max_tokens=16000,
            system=self.sistema,
            tools=self.ferramentas,
            messages=self.historico,
            output_config={"effort": self.cfg.esforco_claude},
            betas=BETAS_FALLBACK,
            fallbacks="default",
            max_iterations=30,
        )
        for resposta in runner:
            # O runner guarda a própria cópia da conversa; espelhamos aqui para o próximo turno.
            self.historico.append({"role": "assistant", "content": resposta.content})
            for bloco in resposta.content:
                if bloco.type == "text" and bloco.text.strip():
                    mostrar(bloco.text)
                elif bloco.type == "tool_use":
                    mostrar(f"  → {bloco.name}({json.dumps(bloco.input, ensure_ascii=False)})")
            if resposta.stop_reason == "refusal":
                mostrar("(O Claude recusou este pedido. Tente reformular.)")
            resultado = runner.generate_tool_call_response()
            if resultado is not None:
                self.historico.append(resultado)

