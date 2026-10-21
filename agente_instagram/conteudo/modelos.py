"""Formatos que o Claude devolve ao planejar conteúdo."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Formato = Literal["feed", "carrossel", "reels", "story"]


class Slide(BaseModel):
    titulo: str = Field(description="Título curto do slide (até 6 palavras).")
    texto: str = Field(description="Texto do slide (até 25 palavras).")
    descricao_imagem: str = Field(
        description="Cena de fundo em inglês para o gerador de imagens, sem texto na imagem. "
        "Vazio para usar só as cores da marca."
    )


class Cena(BaseModel):
    texto_na_tela: str = Field(description="Frase curta que aparece na tela (até 8 palavras).")
    descricao_imagem: str = Field(description="Cena em inglês para o gerador de imagens, sem texto.")
    usar_foto_produto: bool = Field(description="true para usar a foto real do produto nesta cena.")
    duracao_segundos: float = Field(description="Entre 1.5 e 5 segundos.")


class PostPlanejado(BaseModel):
    objetivo: Literal["vender", "engajar", "educar", "bastidores", "prova_social"]
    produto: str = Field(description="Nome exato de um produto do catálogo, ou vazio.")
    tema: str
    titulo_arte: str = Field(description="Frase principal da arte (até 7 palavras).")
    subtitulo_arte: str = Field(description="Complemento da arte (até 12 palavras), pode ser vazio.")
    chamada: str = Field(description="Chamada para ação curta, ex.: 'Peça pelo direct'.")
    legenda: str = Field(description="Legenda completa do post, sem as hashtags.")
    hashtags: list[str] = Field(description="Entre 5 e 12 hashtags, sem o #.")
    descricao_imagem: str = Field(description="Imagem principal em inglês para o gerador, sem texto.")
    slides: list[Slide] = Field(description="Só para carrossel (3 a 7 slides); vazio nos outros.")
    cenas: list[Cena] = Field(description="Só para reels (4 a 7 cenas); vazio nos outros.")


class Plano(BaseModel):
    estrategia: str = Field(description="Resumo de 2 a 4 frases da estratégia do período.")
    posts: list[PostPlanejado] = Field(description="Um post para cada vaga, na mesma ordem.")
