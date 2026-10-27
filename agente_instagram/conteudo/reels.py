"""Monta reels 9:16 a partir das cenas planejadas, usando FFmpeg."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

FPS = 30
LARGURA, ALTURA = 1080, 1920


class ErroVideo(Exception):
    pass


@dataclass
class CenaPronta:
    fundo: Image.Image  # imagem 1080x1920 sem texto (vai ter zoom suave)
    texto: Image.Image  # camada RGBA 1080x1920 com o texto (fica parada)
    duracao: float


def _ffmpeg(*args: str) -> None:
    if not shutil.which("ffmpeg"):
        raise ErroVideo("FFmpeg não está instalado. Veja docs/CONFIGURAR.md.")
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if proc.returncode != 0:
        raise ErroVideo(f"FFmpeg falhou: {proc.stderr.strip()[-800:]}")


def _clipe(cena: CenaPronta, indice: int, pasta: Path) -> Path:
    fundo = pasta / f"fundo_{indice}.png"
    texto = pasta / f"texto_{indice}.png"
    saida = pasta / f"cena_{indice}.mp4"
    cena.fundo.convert("RGB").resize((LARGURA, ALTURA)).save(fundo)
    cena.texto.resize((LARGURA, ALTURA)).save(texto)

    quadros = max(int(round(cena.duracao * FPS)), FPS)
    # Alterna zoom de aproximação e de afastamento para dar ritmo.
    if indice % 2 == 0:
        zoom = f"min(1+0.10*on/{quadros},1.10)"
    else:
        zoom = f"max(1.10-0.10*on/{quadros},1.0)"
    filtro = (
        f"[0:v]scale={LARGURA * 3 // 2}:{ALTURA * 3 // 2},"
        f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={quadros}:s={LARGURA}x{ALTURA}:fps={FPS}[bg];"
        f"[1:v]format=rgba,fade=t=in:st=0.1:d=0.35:alpha=1[txt];"
        f"[bg][txt]overlay=0:0,format=yuv420p[v]"
    )
    _ffmpeg(
        "-i", str(fundo),
        "-loop", "1", "-t", f"{quadros / FPS:.3f}", "-i", str(texto),
        "-filter_complex", filtro,
        "-map", "[v]", "-frames:v", str(quadros),
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", str(FPS),
        str(saida),
    )
    return saida


def montar_reels(cenas: list[CenaPronta], destino: Path, musica: Path | None = None) -> Path:
    """Gera o MP4 final (H.264 + AAC, 1080x1920, 30 fps) pronto para o Instagram."""
    if not cenas:
        raise ErroVideo("O reels precisa de pelo menos uma cena.")
    destino.parent.mkdir(parents=True, exist_ok=True)
    duracao_total = sum(max(c.duracao, 1.0) for c in cenas)

    with tempfile.TemporaryDirectory() as tmp:
        pasta = Path(tmp)
        clipes = [_clipe(c, i, pasta) for i, c in enumerate(cenas)]
        lista = pasta / "lista.txt"
        lista.write_text("".join(f"file '{c.as_posix()}'\n" for c in clipes), encoding="utf-8")
        video = pasta / "video.mp4"
        _ffmpeg("-f", "concat", "-safe", "0", "-i", str(lista), "-c", "copy", str(video))

        if musica and musica.exists():
            audio = ["-stream_loop", "-1", "-i", str(musica)]
            fade = max(duracao_total - 1.5, 0)
            filtro_audio = ["-af", f"volume=0.8,afade=t=out:st={fade:.2f}:d=1.5"]
        else:
            # O Instagram aceita melhor vídeos com faixa de áudio, mesmo que silenciosa.
            audio = ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
            filtro_audio = []
        _ffmpeg(
            "-i", str(video), *audio,
            "-map", "0:v", "-map", "1:a", *filtro_audio,
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
            "-t", f"{duracao_total:.3f}", "-shortest", "-movflags", "+faststart",
            str(destino),
        )
    return destino
