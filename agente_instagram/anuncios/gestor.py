"""Tráfego pago: impulsiona os melhores posts e otimiza as campanhas, dentro de limites fixos.

Regras de segurança (valem para o agente de IA e para a rotina automática):
- Nada é criado se `anuncios.ativo` for false no marca.yaml.
- Nenhuma campanha passa do orçamento diário máximo; a soma das campanhas ativas não passa
  do total diário; e a projeção do mês (gasto real + o que ainda vai gastar) não passa do
  orçamento mensal.
- Por padrão a campanha nasce PAUSADA e só gasta depois de `anuncios aprovar <id>`.
  Só com `ativar_automaticamente: true` ela já nasce ativa (e ainda respeita os limites).
- O otimizador só pausa ou aumenta orçamento seguindo as regras numéricas do marca.yaml;
  a IA não decide sozinha quanto gastar.
"""

from __future__ import annotations

import calendar
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from ..config import Config
from ..estado import Estado, agora_utc, novo_id
from ..instagram.graph import ErroMeta, GraphAPI
from ..instagram.metricas import taxa_engajamento

# objetivo no marca.yaml -> (objetivo da campanha, meta de otimização, destino)
OBJETIVOS = {
    "trafego": ("OUTCOME_TRAFFIC", "LINK_CLICKS", "WEBSITE"),
    "engajamento": ("OUTCOME_ENGAGEMENT", "POST_ENGAGEMENT", "ON_POST"),
    "alcance": ("OUTCOME_AWARENESS", "REACH", None),
}
EM_ANDAMENTO = ("ATIVA", "AGUARDANDO_APROVACAO", "PAUSADA")


class Bloqueado(Exception):
    """Ação de anúncio barrada por uma regra de segurança."""


class GestorAnuncios:
    def __init__(self, cfg: Config, estado: Estado, graph: GraphAPI | None = None):
        self.cfg = cfg
        self.estado = estado
        self.graph = graph
        self.regras = cfg.anuncios
        if not cfg.simulacao and graph is None:
            raise ValueError("GraphAPI é obrigatória fora do modo simulação")

    # ------------------------------------------------------------ limites

    def _valor(self, chave: str, padrao: float) -> float:
        # Regras de otimização ficam em anuncios.regras; limites, direto em anuncios.
        return float(self.regras.get("regras", {}).get(chave, self.regras.get(chave, padrao)))

    @property
    def max_campanha(self) -> float:
        return self._valor("orcamento_diario_max", 20)

    @property
    def max_total_diario(self) -> float:
        return self._valor("orcamento_diario_total_max", 40)

    @property
    def max_mensal(self) -> float:
        return self._valor("orcamento_mensal_max", 500)

    def gasto_mes(self) -> float:
        """Gasto real do mês na conta de anúncios (todas as campanhas, não só as do agente)."""
        if self.cfg.simulacao:
            return float(self.regras.get("gasto_simulado_mes", 0))
        resp = self.graph.get(f"{self.cfg.meta.conta_anuncios}/insights", fields="spend", date_preset="this_month")
        dados = resp.get("data") or []
        return float(dados[0].get("spend", 0)) if dados else 0.0

    def ativas(self) -> list[dict]:
        return [c for c in self.estado.campanhas if c["status"] == "ATIVA"]

    def _dias_restantes_mes(self) -> int:
        hoje = datetime.now(ZoneInfo(self.cfg.fuso)).date()
        return calendar.monthrange(hoje.year, hoje.month)[1] - hoje.day + 1

    def _dias_restantes(self, campanha: dict) -> int:
        termina = datetime.fromisoformat(campanha["termina_em"])
        dias = (termina - agora_utc()).total_seconds() / 86400
        return max(min(int(dias) + 1, self._dias_restantes_mes()), 0)

    def checar_limites(self, orcamento_diario: float, dias: int, excluir: str | None = None) -> None:
        if orcamento_diario <= 0:
            raise Bloqueado("O orçamento diário precisa ser maior que zero.")
        if orcamento_diario > self.max_campanha:
            raise Bloqueado(f"R$ {orcamento_diario:.2f}/dia passa do máximo por campanha (R$ {self.max_campanha:.2f}).")
        outras = [c for c in self.ativas() if c["campanha_id"] != excluir]
        total = sum(c["orcamento_diario"] for c in outras) + orcamento_diario
        if total > self.max_total_diario:
            raise Bloqueado(
                f"Somando as campanhas ativas daria R$ {total:.2f}/dia; o limite é R$ {self.max_total_diario:.2f}."
            )
        gasto = self.gasto_mes()
        projecao = gasto + sum(c["orcamento_diario"] * self._dias_restantes(c) for c in outras)
        projecao += orcamento_diario * min(dias, self._dias_restantes_mes())
        if projecao > self.max_mensal:
            raise Bloqueado(
                f"Gasto do mês até agora R$ {gasto:.2f}; com esta campanha a previsão vai a R$ {projecao:.2f}, "
                f"acima do limite mensal de R$ {self.max_mensal:.2f}."
            )

    # ---------------------------------------------------------- campanhas

    def _segmentacao(self) -> dict:
        p = self.regras.get("publico", {})
        if p.get("latitude") is not None and p.get("longitude") is not None:
            geo = {
                "custom_locations": [
                    {
                        "latitude": p["latitude"],
                        "longitude": p["longitude"],
                        "radius": p.get("raio_km", 10),
                        "distance_unit": "kilometer",
                    }
                ]
            }
        else:
            geo = {"countries": p.get("paises", ["BR"])}
        alvo = {
            "geo_locations": geo,
            "age_min": int(p.get("idade_min", 18)),
            "age_max": int(p.get("idade_max", 65)),
            "publisher_platforms": ["instagram"],
            "instagram_positions": ["stream", "story", "reels", "explore"],
            "targeting_automation": {"advantage_audience": 0},
        }
        generos = {"masculino": 1, "feminino": 2}
        if p.get("genero") in generos:
            alvo["genders"] = [generos[p["genero"]]]
        return alvo

    def _criar_na_meta(self, post: dict, registro: dict, ativar: bool) -> None:
        g, conta = self.graph, self.cfg.meta.conta_anuncios
        objetivo, otimizacao, destino = OBJETIVOS[registro["objetivo"]]
        nome = f"[Agente IA] {post.get('tema', '')[:40]} {agora_utc():%d/%m}"
        registro["campanha_id"] = g.post(
            f"{conta}/campaigns",
            name=nome,
            objective=objetivo,
            status="ACTIVE" if ativar else "PAUSED",
            special_ad_categories=[],
            daily_budget=int(round(registro["orcamento_diario"] * 100)),
            bid_strategy="LOWEST_COST_WITHOUT_CAP",
        )["id"]
        try:
            # Conjunto e anúncio nascem ativos; quem liga e desliga o gasto é a campanha.
            registro["conjunto_id"] = g.post(
                f"{conta}/adsets",
                name=nome,
                campaign_id=registro["campanha_id"],
                billing_event="IMPRESSIONS",
                optimization_goal=otimizacao,
                destination_type=destino,
                targeting=self._segmentacao(),
                start_time=agora_utc().isoformat(timespec="seconds"),
                end_time=registro["termina_em"],
                status="ACTIVE",
            )["id"]
            criativo = {
                "name": nome,
                "object_id": self.cfg.meta.pagina_id,
                "instagram_user_id": self.cfg.meta.instagram_user_id,
                "source_instagram_media_id": post["ig_media_id"],
            }
            if registro["objetivo"] == "trafego":
                criativo["call_to_action"] = {
                    "type": self.regras.get("chamada", "SHOP_NOW"),
                    "value": {"link": self.regras["link_destino"]},
                }
            registro["criativo_id"] = g.post(f"{conta}/adcreatives", **criativo)["id"]
            registro["anuncio_id"] = g.post(
                f"{conta}/ads",
                name=nome,
                adset_id=registro["conjunto_id"],
                creative={"creative_id": registro["criativo_id"]},
                status="ACTIVE",
            )["id"]
        except ErroMeta:
            # Não deixa campanha pela metade rodando.
            g.post(registro["campanha_id"], status="PAUSED")
            raise

    def impulsionar(self, post_id: str, orcamento_diario: float | None = None, dias: int | None = None) -> dict:
        if not self.regras.get("ativo"):
            raise Bloqueado("Os anúncios estão desligados (anuncios.ativo: false no marca.yaml).")
        post = self.estado.post(post_id)
        if post["status"] != "publicado" or not (post.get("ig_media_id") or self.cfg.simulacao):
            raise Bloqueado("Só dá para impulsionar um post que já foi publicado no Instagram.")
        if any(c["post_id"] == post_id and c["status"] in EM_ANDAMENTO for c in self.estado.campanhas):
            raise Bloqueado("Este post já tem uma campanha em andamento.")

        orcamento = min(float(orcamento_diario or self.regras.get("orcamento_diario_padrao", self.max_campanha)), self.max_campanha)
        dias = int(dias or self.regras.get("duracao_dias", 7))
        ativar = bool(self.regras.get("ativar_automaticamente", False))
        objetivo = self.regras.get("objetivo", "engajamento")
        if objetivo not in OBJETIVOS:
            raise Bloqueado(f"Objetivo '{objetivo}' inválido. Use: {', '.join(OBJETIVOS)}.")
        if objetivo == "trafego" and not self.regras.get("link_destino"):
            objetivo = "engajamento"
        # Mesmo pausada, a campanha precisa caber nos limites para poder ser aprovada depois.
        self.checar_limites(orcamento, dias)

        registro = {
            "campanha_id": "",
            "post_id": post_id,
            "objetivo": objetivo,
            "orcamento_diario": orcamento,
            "dias": dias,
            "termina_em": (agora_utc() + timedelta(days=dias)).isoformat(timespec="seconds"),
            "status": "ATIVA" if ativar else "AGUARDANDO_APROVACAO",
            "criado_em": agora_utc().isoformat(),
            "simulado": self.cfg.simulacao,
        }
        if self.cfg.simulacao:
            registro["campanha_id"] = f"sim_{novo_id()}"
        else:
            try:
                self._criar_na_meta(post, registro, ativar)
            except ErroMeta as erro:
                # Registra a falha para a rotina não tentar de novo a cada hora.
                registro["status"] = "ERRO"
                registro["erro"] = str(erro)
                self.estado.campanhas.append(registro)
                self.estado.registrar("erro_campanha", post_id=post_id, erro=str(erro))
                self.estado.salvar()
                raise
        self.estado.campanhas.append(registro)
        self.estado.registrar("campanha_criada", **{k: registro[k] for k in ("campanha_id", "post_id", "orcamento_diario", "status")})
        self.estado.salvar()
        return registro

    def aprovar(self, campanha_id: str) -> dict:
        """Liga uma campanha que estava esperando aprovação ou pausada. Só o dono da loja chama isto."""
        c = self.estado.campanha(campanha_id)
        if c["status"] not in ("AGUARDANDO_APROVACAO", "PAUSADA"):
            raise Bloqueado(f"A campanha está {c['status']}; não dá para ativar.")
        self.checar_limites(c["orcamento_diario"], self._dias_restantes(c), excluir=campanha_id)
        if not self.cfg.simulacao:
            self.graph.post(campanha_id, status="ACTIVE")
        c["status"] = "ATIVA"
        self.estado.registrar("campanha_ativada", campanha_id=campanha_id)
        self.estado.salvar()
        return c

    def pausar(self, campanha_id: str, motivo: str = "pedido manual") -> dict:
        c = self.estado.campanha(campanha_id)
        if not self.cfg.simulacao and not c.get("simulado"):
            self.graph.post(campanha_id, status="PAUSED")
        c["status"] = "PAUSADA"
        c["motivo_pausa"] = motivo
        self.estado.registrar("campanha_pausada", campanha_id=campanha_id, motivo=motivo)
        self.estado.salvar()
        return c

    def desempenho(self, campanha_id: str) -> dict:
        resp = self.graph.get(
            f"{campanha_id}/insights", fields="spend,impressions,reach,clicks,ctr,cpc", date_preset="maximum"
        )
        d = (resp.get("data") or [{}])[0]
        return {
            "gasto": float(d.get("spend", 0)),
            "impressoes": int(d.get("impressions", 0)),
            "alcance": int(d.get("reach", 0)),
            "cliques": int(d.get("clicks", 0)),
            "ctr": float(d.get("ctr", 0)),
            "cpc": float(d.get("cpc", 0)),
        }

    # ---------------------------------------------------------- automação

    def otimizar(self) -> list[str]:
        """Aplica as regras do marca.yaml: encerra, pausa as ruins e escala as boas."""
        acoes: list[str] = []
        agora = agora_utc()
        for c in self.estado.campanhas:
            if c["status"] in EM_ANDAMENTO and datetime.fromisoformat(c["termina_em"]) <= agora:
                c["status"] = "ENCERRADA"
                acoes.append(f"Campanha {c['campanha_id']} chegou ao fim do período.")

        if self.ativas() and self.gasto_mes() >= self.max_mensal:
            for c in self.ativas():
                self.pausar(c["campanha_id"], "limite mensal atingido")
                acoes.append(f"Pausei {c['campanha_id']}: limite mensal de R$ {self.max_mensal:.2f} atingido.")
            self.estado.salvar()
            return acoes

        gasto_min = self._valor("gasto_min_para_avaliar", 15)
        cpc_max = self._valor("cpc_max", 1.5)
        ctr_min = self._valor("ctr_min", 0.8)
        cpc_bom = self._valor("escalar_se_cpc_abaixo", 0.5)
        aumento = self._valor("aumento_percentual", 20)

        for c in self.ativas():
            if c.get("simulado") or self.cfg.simulacao:
                continue
            d = c["desempenho"] = self.desempenho(c["campanha_id"])
            if d["gasto"] < gasto_min:
                continue
            if (d["cliques"] and d["cpc"] > cpc_max) or d["ctr"] < ctr_min:
                self.pausar(c["campanha_id"], f"CPC R$ {d['cpc']:.2f} / CTR {d['ctr']:.2f}% fora da meta")
                acoes.append(f"Pausei {c['campanha_id']}: CPC R$ {d['cpc']:.2f}, CTR {d['ctr']:.2f}%.")
            elif d["cliques"] and d["cpc"] <= cpc_bom:
                novo = min(round(c["orcamento_diario"] * (1 + aumento / 100), 2), self.max_campanha)
                if novo <= c["orcamento_diario"]:
                    continue
                try:
                    self.checar_limites(novo, self._dias_restantes(c), excluir=c["campanha_id"])
                except Bloqueado as motivo:
                    acoes.append(f"Não escalei {c['campanha_id']}: {motivo}")
                    continue
                self.graph.post(c["campanha_id"], daily_budget=int(round(novo * 100)))
                acoes.append(f"Aumentei {c['campanha_id']} de R$ {c['orcamento_diario']:.2f} para R$ {novo:.2f}/dia.")
                c["orcamento_diario"] = novo

        for a in acoes:
            self.estado.registrar("otimizacao", acao=a)
        self.estado.salvar()
        return acoes

    def impulsionar_melhores(self) -> list[dict]:
        """Impulsiona os posts recentes com melhor engajamento (até N por semana)."""
        por_semana = int(self.regras.get("impulsionar_top_posts_por_semana", 0))
        if not self.regras.get("ativo") or por_semana <= 0:
            return []
        semana = agora_utc() - timedelta(days=7)
        recentes = [c for c in self.estado.campanhas if datetime.fromisoformat(c["criado_em"]) >= semana]
        vagas = por_semana - len(recentes)
        if vagas <= 0:
            return []
        ja_impulsionados = {c["post_id"] for c in self.estado.campanhas}
        janela = agora_utc() - timedelta(days=14)
        alcance_min = int(self.regras.get("alcance_minimo", 100))
        candidatos = [
            p
            for p in self.estado.por_status("publicado")
            if p["formato"] != "story"
            and p["id"] not in ja_impulsionados
            and datetime.fromisoformat(p["publicado_em"]) >= janela
            and (p.get("ig_media_id") or self.cfg.simulacao)
            and p.get("metricas", {}).get("alcance", 0) >= alcance_min
        ]
        candidatos.sort(key=taxa_engajamento, reverse=True)
        criadas = []
        for post in candidatos[:vagas]:
            try:
                criadas.append(self.impulsionar(post["id"]))
            except (Bloqueado, ErroMeta) as erro:
                self.estado.registrar("impulsionar_bloqueado", post=post["id"], motivo=str(erro))
                break
        self.estado.salvar()
        return criadas

    def resumo(self) -> dict:
        return {
            "anuncios_ligados": bool(self.regras.get("ativo")),
            "simulacao": self.cfg.simulacao,
            "gasto_mes": self.gasto_mes(),
            "limites": {
                "por_campanha_dia": self.max_campanha,
                "total_dia": self.max_total_diario,
                "mes": self.max_mensal,
            },
            "campanhas": [
                {k: c.get(k) for k in ("campanha_id", "post_id", "status", "orcamento_diario", "termina_em", "desempenho", "motivo_pausa")}
                for c in self.estado.campanhas[-20:]
            ],
        }
