"""Gera as artes dos posts: imagem de fundo (IA ou foto do produto) + texto da marca."""

from __future__ import annotations

import base64
import io
import mimetypes
import re
from functools import lru_cache
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

from ..config import Config

TAMANHOS = {
    "feed": (1080, 1350),
    "carrossel": (1080, 1350),
    "story": (1080, 1920),
    "reels": (1080, 1920),
}

FONTES_SISTEMA = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]

# Emojis e símbolos que as fontes comuns não desenham (viram quadradinhos na arte).
_SEM_GLIFO = re.compile("[\U0001f000-\U0001faff\u2600-\u27bf\ufe0f\u200d]")

OPENAI_URL = "https://api.openai.com/v1/images"


class ErroImagem(Exception):
    pass


# ---------------------------------------------------------------- utilidades


def cor(hexa: str, padrao: str = "#222222") -> tuple[int, int, int]:
    hexa = (hexa or padrao).lstrip("#")
    return tuple(int(hexa[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


@lru_cache(maxsize=32)
def fonte(caminho: str | None, tamanho: int) -> ImageFont.FreeTypeFont:
    for c in [caminho, *FONTES_SISTEMA]:
        if c and Path(c).exists():
            return ImageFont.truetype(c, tamanho)
    return ImageFont.load_default(tamanho)


def limpar_texto(texto: str) -> str:
    return re.sub(r"\s+", " ", _SEM_GLIFO.sub("", texto or "")).strip()


def preencher(img: Image.Image, tamanho: tuple[int, int]) -> Image.Image:
    """Redimensiona e corta a imagem para cobrir todo o tamanho pedido."""
    return ImageOps.fit(img.convert("RGB"), tamanho, Image.LANCZOS, centering=(0.5, 0.45))


def gradiente(tamanho: tuple[int, int], c1: tuple, c2: tuple) -> Image.Image:
    w, h = tamanho
    topo = Image.new("RGB", (1, 2))
    topo.putpixel((0, 0), c1)
    topo.putpixel((0, 1), c2)
    return topo.resize((w, h), Image.BILINEAR)


def quebrar_linhas(desenho: ImageDraw.ImageDraw, texto: str, f, largura_max: int) -> list[str]:
    linhas: list[str] = []
    atual = ""
    for palavra in texto.split():
        teste = f"{atual} {palavra}".strip()
        if desenho.textlength(teste, font=f) <= largura_max or not atual:
            atual = teste
        else:
            linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def texto_que_cabe(desenho, texto, caminho_fonte, tamanho_inicial, largura_max, max_linhas):
    """Diminui a fonte até o texto caber no número máximo de linhas."""
    tamanho = tamanho_inicial
    while True:
        f = fonte(caminho_fonte, tamanho)
        linhas = quebrar_linhas(desenho, texto, f, largura_max)
        if len(linhas) <= max_linhas or tamanho <= 28:
            return f, linhas
        tamanho -= 6


# ------------------------------------------------------- geração com IA


def _openai(cfg: Config, prompt: str, referencia: Path | None) -> Image.Image:
    cabecalho = {"Authorization": f"Bearer {cfg.openai_key}"}
    dados = {"model": cfg.openai_modelo_imagem, "prompt": prompt, "size": "1024x1536", "quality": "medium"}
    if referencia:
        tipo = mimetypes.guess_type(referencia.name)[0] or "image/png"
        with referencia.open("rb") as arq:
            resp = requests.post(
                f"{OPENAI_URL}/edits",
                headers=cabecalho,
                data=dados,
                files=[("image[]", (referencia.name, arq, tipo))],
                timeout=300,
            )
    else:
        resp = requests.post(f"{OPENAI_URL}/generations", headers=cabecalho, json=dados, timeout=300)
    if resp.status_code != 200:
        raise ErroImagem(f"Gerador de imagens respondeu {resp.status_code}: {resp.text[:300]}")
    b64 = resp.json()["data"][0]["b64_json"]
    return Image.open(io.BytesIO(base64.b64decode(b64)))


def _prompt_ia(cfg: Config, descricao: str, com_produto: bool) -> str:
    estilo = cfg.visual.get("estilo_imagens", "clean product photography, natural light")
    partes = []
    if com_produto:
        partes.append(
            "Use the product from the reference photo exactly as it is: same shape, colors, "
            "label and proportions. Do not redesign it."
        )
    partes += [
        descricao,
        f"Style: {estilo}.",
        f"Color palette inspired by {cfg.visual.get('cor_primaria', '')} and "
        f"{cfg.visual.get('cor_secundaria', '')}.",
        "Vertical composition with clean space in the upper and lower thirds for text overlay.",
        "Absolutely no text, letters, numbers, logos or watermarks in the image.",
    ]
    return " ".join(p for p in partes if p.strip())


def _produto_sobre_fundo(foto: Path, tamanho: tuple[int, int], c1: tuple, c2: tuple) -> Image.Image:
    """Sem IA: coloca a foto real do produto centralizada sobre um fundo nas cores da marca."""
    fundo = gradiente(tamanho, c1, c2)
    produto = Image.open(foto).convert("RGB")
    # Ocupa a parte de cima; a de baixo fica livre para o texto da arte.
    vertical = tamanho[1] > tamanho[0] * 1.5
    produto = ImageOps.contain(produto, (int(tamanho[0] * 0.78), int(tamanho[1] * (0.36 if vertical else 0.40))))
    moldura = Image.new("RGB", (produto.width + 24, produto.height + 24), (255, 255, 255))
    moldura.paste(produto, (12, 12))
    sombra = Image.new("RGBA", fundo.size, (0, 0, 0, 0))
    x = (tamanho[0] - moldura.width) // 2
    y = int(tamanho[1] * (0.14 if vertical else 0.12))
    ImageDraw.Draw(sombra).rectangle([x + 10, y + 16, x + moldura.width + 10, y + moldura.height + 16], fill=(0, 0, 0, 90))
    fundo = Image.alpha_composite(fundo.convert("RGBA"), sombra.filter(ImageFilter.GaussianBlur(18)))
    fundo.paste(moldura, (x, y))
    return fundo.convert("RGB")


def imagem_base(
    cfg: Config, descricao: str, tamanho: tuple[int, int], foto_produto: Path | None = None
) -> Image.Image:
    """Imagem de fundo do post, sem texto."""
    c1 = cor(cfg.visual.get("cor_primaria"), "#7a3cff")
    c2 = cor(cfg.visual.get("cor_secundaria"), "#ff7a59")
    if cfg.provedor_imagens == "openai" and cfg.openai_key and descricao:
        img = _openai(cfg, _prompt_ia(cfg, descricao, bool(foto_produto)), foto_produto)
        return preencher(img, tamanho)
    if foto_produto and foto_produto.exists():
        return _produto_sobre_fundo(foto_produto, tamanho, c1, c2)
    return gradiente(tamanho, c1, c2)


# ----------------------------------------------------------- composição


def camada_texto(
    cfg: Config,
    tamanho: tuple[int, int],
    titulo: str,
    subtitulo: str = "",
    chamada: str = "",
    preco: str = "",
    posicao: str = "baixo",
) -> Image.Image:
    """Camada transparente com textos, selo de preço e logo, para colar sobre a imagem."""
    w, h = tamanho
    camada = Image.new("RGBA", tamanho, (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    caminho_fonte = str(cfg.caminho(cfg.visual.get("fonte"))) if cfg.visual.get("fonte") else None
    cor_texto = cor(cfg.visual.get("cor_texto"), "#ffffff")
    cor_destaque = cor(cfg.visual.get("cor_primaria"), "#7a3cff")
    margem = int(w * 0.08)
    largura = w - 2 * margem

    titulo, subtitulo, chamada, preco = map(limpar_texto, (titulo, subtitulo, chamada, preco))

    # Faixa escura degradê atrás do texto para garantir leitura sobre qualquer foto.
    sombra = Image.new("L", (1, 256))
    for i in range(256):
        sombra.putpixel((0, i), int(200 * (i / 255) ** 1.6))
    altura_faixa = int(h * 0.55)
    if posicao == "baixo":
        faixa = sombra.resize((w, altura_faixa))
        camada.paste((0, 0, 0, 255), (0, h - altura_faixa), faixa)
    else:
        faixa = sombra.transpose(Image.FLIP_TOP_BOTTOM).resize((w, altura_faixa))
        camada.paste((0, 0, 0, 255), (0, 0), faixa)

    f_tit, linhas_tit = texto_que_cabe(d, titulo.upper(), caminho_fonte, int(w * 0.085), largura, 3)
    f_sub, linhas_sub = texto_que_cabe(d, subtitulo, caminho_fonte, int(w * 0.045), largura, 3)
    f_cta = fonte(caminho_fonte, int(w * 0.042))

    alt_linha_tit = int(f_tit.size * 1.12)
    alt_linha_sub = int(f_sub.size * 1.25)
    alt_cta = int(f_cta.size * 2.2) if chamada else 0
    bloco = len(linhas_tit) * alt_linha_tit + len(linhas_sub) * alt_linha_sub + alt_cta + 40

    # Reels/stories: o rodapé fica coberto pelos botões do app, então o texto sobe.
    rodape = int(h * 0.20) if h > w * 1.5 else int(h * 0.07)
    y = h - rodape - bloco if posicao == "baixo" else int(h * 0.12)

    for linha in linhas_tit:
        d.text((margem, y), linha, font=f_tit, fill=cor_texto)
        y += alt_linha_tit
    y += 12
    for linha in linhas_sub:
        d.text((margem, y), linha, font=f_sub, fill=cor_texto)
        y += alt_linha_sub
    if chamada:
        y += 20
        largura_cta = int(d.textlength(chamada, font=f_cta)) + 2 * int(f_cta.size * 0.9)
        d.rounded_rectangle(
            [margem, y, margem + largura_cta, y + int(f_cta.size * 1.9)], radius=int(f_cta.size), fill=cor_destaque
        )
        d.text((margem + int(f_cta.size * 0.9), y + int(f_cta.size * 0.42)), chamada, font=f_cta, fill=(255, 255, 255))

    if preco:
        f_preco = fonte(caminho_fonte, int(w * 0.06))
        larg = int(d.textlength(preco, font=f_preco)) + 60
        alt = int(f_preco.size * 1.7)
        x0, y0 = w - margem - larg, int(h * 0.06) + (int(h * 0.05) if h > w * 1.5 else 0)
        d.rounded_rectangle([x0, y0, x0 + larg, y0 + alt], radius=alt // 2, fill=(255, 255, 255))
        d.text((x0 + 30, y0 + int(f_preco.size * 0.3)), preco, font=f_preco, fill=cor_destaque)

    logo = cfg.caminho(cfg.visual.get("logo"))
    if logo and logo.exists():
        img_logo = Image.open(logo).convert("RGBA")
        img_logo = ImageOps.contain(img_logo, (int(w * 0.22), int(w * 0.12)))
        topo = int(h * 0.06) + (int(h * 0.05) if h > w * 1.5 else 0)
        camada.alpha_composite(img_logo, (margem, topo))
    return camada


def compor(base: Image.Image, camada: Image.Image) -> Image.Image:
    return Image.alpha_composite(base.convert("RGBA"), camada).convert("RGB")


def texto_preco(produto: dict | None) -> str:
    if not produto:
        return ""
    valor = produto.get("preco_promocional") or produto.get("preco")
    if not valor:
        return ""
    if isinstance(valor, (int, float)):
        return "R$ " + f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return str(valor)


def salvar_jpg(img: Image.Image, destino: Path) -> Path:
    destino.parent.mkdir(parents=True, exist_ok=True)
    img.save(destino, "JPEG", quality=92, optimize=True)
    return destino
