"""Planeja o calendário de conteúdo da loja com o Claude."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from ..config import Config
from ..estado import Estado, agora_utc
from ..llm import bloco_imagem, gerar_estruturado
from .modelos import Formato, Plano

DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]

SISTEMA = """\
Você é o social media de uma pequena loja brasileira e cuida sozinho do Instagram dela.
Seu trabalho é planejar posts que façam a loja vender mais, sem parecer propaganda chata.

Regras:
- Escreva em português do Brasil, no tom de voz da loja.
- Legenda: a primeira linha precisa prender a atenção; depois, texto curto e escaneável,
  emojis com moderação e uma chamada para ação clara no final (direct, WhatsApp, link na bio).
- Nunca invente preço, desconto, frete, prazo ou promoção que não esteja nos dados da loja.
  Nunca prometa nada da lista "evitar".
- Varie formatos e assuntos: produto em destaque, dica de uso, bastidores, dúvida frequente,
  prova social, tendência do nicho. Não repita temas dos posts já agendados.
- Use o que funcionou melhor nos resultados recentes (quando houver) para decidir os temas.
- descricao_imagem, descricao das cenas e dos slides: em inglês, como pedido para um gerador
  de imagens fotográficas. Descreva cenário, luz, enquadramento e clima. Nunca peça texto,
  letras, logotipos ou marcas d'água na imagem: o texto é colocado depois pelo sistema.
- Quando o post é sobre um produto que tem foto, descreva o cenário onde o produto vai
  aparecer; a foto real do produto é usada como referência para não distorcê-lo.
- Reels: 4 a 7 cenas, 10 a 30 segundos no total; a primeira cena é o gancho (até 2 s).
- Carrossel: 3 a 7 slides; o primeiro é a capa com a promessa, o último tem a chamada.
- Story: uma arte só, direta, com chamada para responder ou clicar.
"""


@dataclass
class Vaga:
    quando: datetime
    formato: Formato

    def descricao(self) -> str:
        dia = DIAS_SEMANA[self.quando.weekday()]
        return f"{self.formato} em {dia} {self.quando:%d/%m às %H:%M}"


def _hora(texto: str) -> time:
    h, m = texto.split(":")
    return time(int(h), int(m))


def _espalhar(itens: list, quantidade: int) -> list:
    """Escolhe `quantidade` itens espaçados de forma uniforme."""
    if quantidade <= 0 or not itens:
        return []
    quantidade = min(quantidade, len(itens))
    passo = len(itens) / quantidade
    return [itens[int(i * passo)] for i in range(quantidade)]


def _intercalar(contagem: dict[str, int]) -> list[str]:
    """Mistura os formatos para não ficarem todos seguidos (reels, feed, carrossel, reels...)."""
    restantes = dict(contagem)
    saida: list[str] = []
    while any(restantes.values()):
        for formato in sorted(restantes, key=lambda f: -restantes[f]):
            if restantes[formato]:
                saida.append(formato)
                restantes[formato] -= 1
    return saida


def calcular_vagas(cfg: Config, estado: Estado, inicio: date, dias: int) -> list[Vaga]:
    cal = cfg.calendario
    tz = ZoneInfo(cfg.fuso)
    dias_ok = [d.lower()[:3] for d in cal.get("dias", DIAS_SEMANA[:6])]
    horarios = [_hora(h) for h in cal.get("horarios", ["12:00", "19:00"])]
    por_semana = cal.get("por_semana", {"feed": 2, "carrossel": 1, "reels": 2, "story": 0})
    semanas = dias / 7

    agora = agora_utc()
    ocupados = {
        datetime.fromisoformat(p["agendado_para"]).astimezone(tz).replace(second=0, microsecond=0)
        for p in estado.por_status("planejado", "produzido", "aguardando_aprovacao")
    }
    datas = [
        inicio + timedelta(days=i)
        for i in range(dias)
        if DIAS_SEMANA[(inicio + timedelta(days=i)).weekday()] in dias_ok
    ]

    def livres(horas: list[time]) -> list[datetime]:
        candidatos = [datetime.combine(d, h, tzinfo=tz) for d in datas for h in horas]
        return [c for c in candidatos if c > agora and c not in ocupados]

    contagem = {f: round(por_semana.get(f, 0) * semanas) for f in ("reels", "feed", "carrossel")}
    formatos = _intercalar(contagem)
    slots = _espalhar(livres(horarios), len(formatos))
    vagas = [Vaga(q, f) for q, f in zip(slots, formatos)]

    n_stories = round(por_semana.get("story", 0) * semanas)
    horario_story = _hora(cal.get("horario_stories", "10:00"))
    vagas += [Vaga(q, "story") for q in _espalhar(livres([horario_story]), n_stories)]
    return sorted(vagas, key=lambda v: v.quando)


def _resumo_desempenho(estado: Estado) -> str:
    publicados = [p for p in estado.por_status("publicado") if p.get("metricas", {}).get("alcance")]
    if not publicados:
        return "Ainda não há resultados medidos."

    def taxa(p: dict) -> float:
        m = p["metricas"]
        return m.get("interacoes", 0) / max(m.get("alcance", 1), 1)

    publicados.sort(key=taxa, reverse=True)
    linhas = []
    for rotulo, grupo in (("Melhores", publicados[:5]), ("Piores", publicados[-3:])):
        for p in grupo:
            m = p["metricas"]
            linhas.append(
                f"{rotulo}: [{p['formato']}] {p['tema']} — alcance {m.get('alcance', 0)}, "
                f"interações {m.get('interacoes', 0)}, salvamentos {m.get('salvamentos', 0)}"
            )
    return "\n".join(linhas)


def _contexto_loja(cfg: Config) -> str:
    produtos = [
        {
            "nome": p.get("nome"),
            "preco": p.get("preco"),
            "preco_promocional": p.get("preco_promocional"),
            "descricao": p.get("descricao"),
            "tem_foto": bool(p.get("fotos")),
            "link": p.get("link"),
        }
        for p in cfg.produtos
    ]
    dados = {
        "loja": cfg.loja,
        "estilo_visual": cfg.visual.get("estilo_imagens", ""),
        "produtos": produtos,
        "hashtags_base": cfg.marca.get("hashtags_base", []),
        "datas_especiais": cfg.calendario.get("datas_especiais", []),
    }
    return json.dumps(dados, ensure_ascii=False, indent=2)


def _fotos_para_referencia(cfg: Config, limite: int = 6) -> list[dict]:
    """Primeira foto de cada produto, para o Claude ver como eles são de verdade."""
    blocos = []
    for p in cfg.produtos:
        fotos = p.get("fotos") or []
        caminho = cfg.caminho(fotos[0]) if fotos else None
        if caminho and caminho.exists():
            blocos.append({"type": "text", "text": f"Foto do produto: {p.get('nome')}"})
            blocos.append(bloco_imagem(caminho))
        if len(blocos) >= limite * 2:
            break
    return blocos


def planejar(cfg: Config, estado: Estado, vagas: list[Vaga], briefing: str = "") -> list[dict]:
    """Pede ao Claude um post para cada vaga e coloca todos na fila."""
    if not vagas:
        return []

    ja_agendados = [
        f"- {p['formato']} {p['agendado_para'][:16]}: {p['tema']}"
        for p in estado.por_status("planejado", "produzido", "aguardando_aprovacao", "publicado")
    ][-30:]

    texto = f"""\
Dados da loja:
{_contexto_loja(cfg)}

Resultados recentes:
{_resumo_desempenho(estado)}

Posts já agendados ou publicados (não repita):
{chr(10).join(ja_agendados) or "nenhum"}

Pedido especial do dono da loja: {briefing or "nenhum"}

Crie exatamente {len(vagas)} posts, um para cada vaga abaixo, na mesma ordem:
{chr(10).join(f"{i + 1}. {v.descricao()}" for i, v in enumerate(vagas))}
"""
    conteudo = [*_fotos_para_referencia(cfg), {"type": "text", "text": texto}]
    plano = gerar_estruturado(
        modelo=cfg.modelo_claude,
        sistema=SISTEMA,
        conteudo=conteudo,
        formato=Plano,
        esforco=cfg.esforco_claude,
    )

    novos = []
    for vaga, item in zip(vagas, plano.posts):
        post = item.model_dump()
        post["formato"] = vaga.formato
        post["agendado_para"] = vaga.quando.isoformat()
        if vaga.formato != "carrossel":
            post["slides"] = []
        if vaga.formato != "reels":
            post["cenas"] = []
        novos.append(estado.adicionar_post(post))
    estado.registrar("planejamento", estrategia=plano.estrategia, posts=[p["id"] for p in novos])
    estado.salvar()
    return novos


def planejar_periodo(cfg: Config, estado: Estado, dias: int = 7, briefing: str = "") -> list[dict]:
    hoje = datetime.now(ZoneInfo(cfg.fuso)).date()
    pendentes = [datetime.fromisoformat(p["agendado_para"]) for p in estado.pendentes_futuros()]
    # Continua a partir do último dia que já tem post agendado.
    inicio = max([hoje, *[(d.astimezone(ZoneInfo(cfg.fuso)).date() + timedelta(days=1)) for d in pendentes]])
    return planejar(cfg, estado, calcular_vagas(cfg, estado, inicio, dias), briefing)
