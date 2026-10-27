# 🎬 Editor de Vídeo com Agente de IA

> Um editor de vídeo que você controla **conversando**: diga o que quer e o agente faz os cortes, as legendas e a montagem.

![Status](https://img.shields.io/badge/status-em_desenvolvimento-yellow?style=flat-square)
![IA](https://img.shields.io/badge/IA-Agentes_·_LLM-blueviolet?style=flat-square)

---

## 📱 Agente de Instagram para loja (pronto para usar)

Um agente de IA que **cuida do Instagram da sua loja** por você:

- 🗓️ **Planeja** a semana de conteúdo (reels, posts, carrosséis e stories) com base nos seus produtos, no seu público e no que deu mais resultado.
- ✍️ **Escreve** legendas, chamadas e hashtags no tom de voz da loja, sem inventar preço ou promoção.
- 🎨 **Cria as artes** nas cores da marca, com a foto real do produto, preço e logo (com ou sem IA de imagens).
- 🎞️ **Monta os reels** 9:16 com zoom suave, textos na tela e música de fundo.
- 📤 **Publica** no horário certo pela API oficial da Meta.
- 📊 **Mede** alcance, curtidas, salvamentos e compartilhamentos e usa isso para planejar melhor.
- 💰 **Tráfego pago**: impulsiona os posts que foram melhor no orgânico, pausa campanhas caras e escala as boas, **sempre dentro dos limites de orçamento que você define**.
- 💬 **Conversa**: "cria um reels para sexta sobre a promoção de inverno" e ele faz.

Tudo começa em **modo simulação** (nada é publicado nem gasto) até você liberar.

### Começo rápido

```bash
pip install -r requirements.txt
python -m agente_instagram iniciar      # cria marca.yaml e .env
# preencha marca.yaml (sua loja) e .env (chaves)
python -m agente_instagram verificar
python -m agente_instagram planejar     # planeja 7 dias
python -m agente_instagram produzir     # gera artes e reels em dados/midia/
python -m agente_instagram agente       # converse com o agente
```

👉 **Passo a passo completo** (chaves, conexão com o Instagram, automação e anúncios): [docs/CONFIGURAR.md](docs/CONFIGURAR.md)

### Comandos

| Comando | O que faz |
|---|---|
| `iniciar` | Cria `marca.yaml` e `.env` a partir dos exemplos |
| `verificar` | Confere chaves, FFmpeg, fotos e conexão com o Instagram |
| `descobrir` | Mostra os ids da Página, do Instagram e da conta de anúncios |
| `planejar [--dias 7] [--briefing "..."]` | Planeja o conteúdo do período |
| `produzir [--id ID]` | Gera as artes/reels dos posts planejados |
| `fila [--todos]` | Mostra a fila de posts |
| `aprovar ID` | Aprova um post (se a aprovação estiver ligada) |
| `publicar [--id ID]` | Publica os posts que chegaram no horário (ou um específico) |
| `metricas` | Atualiza e mostra os resultados |
| `rotina` | Faz tudo acima + anúncios (rode de hora em hora) |
| `agente ["pedido"]` | Conversa com o agente |
| `anuncios status\|impulsionar\|aprovar\|pausar\|otimizar` | Tráfego pago |

### Como funciona

```
marca.yaml (sua loja) ──► Claude planeja e escreve ──► fila (dados/estado.json)
                                                          │
             ┌────────────────────────────────────────────┤
             ▼                                            ▼
  Artes (Pillow + IA opcional)                 Reels (FFmpeg, 1080x1920)
             └──────────────► hospedagem (Cloudinary) ◄───┘
                                     │
                                     ▼
                     API do Instagram: publica no horário
                                     │
                                     ▼
              métricas ──► melhores posts ──► anúncios (com travas de orçamento)
```

---

## 💡 A ideia do editor

Editar vídeo toma muito tempo. Este projeto cria um **agente de IA** que entende comandos em texto, como *"corta os silêncios, coloca legenda e deixa em formato Reels"*, e executa a edição automaticamente.

## ✨ Funcionalidades planejadas

- [ ] 🗣️ **Edição por comando de texto**
- [ ] ✂️ **Cortes automáticos** (silêncios, erros, partes repetidas)
- [ ] 💬 **Legendas automáticas** (transcrição com IA)
- [ ] 📝 **Montagem a partir de roteiro** usando o material bruto
- [x] 🎨 **Elementos animados** (títulos e textos na tela dos reels)
- [ ] 🧠 **Sugestões de melhoria** feitas pela IA
- [x] 📱 Exportação em formatos para redes sociais (9:16 e 4:5)

## 🏗️ Arquitetura (proposta)

```
Usuário (comando em texto)
        │
        ▼
  Agente (LLM) ──► planeja as etapas da edição
        │
        ├─► Transcrição (fala → texto)
        ├─► Detecção de silêncio e cortes
        ├─► Geração de legendas
        └─► Renderização (FFmpeg)
        │
        ▼
   Vídeo final
```

## 🗺️ Roadmap

1. **MVP**: comando de texto → cortes + legendas → exportar
2. Montagem a partir de roteiro
3. Elementos animados
4. Interface visual com prévia

## 🛠️ Stack

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=flat-square&logo=ffmpeg&logoColor=white)
![LLM](https://img.shields.io/badge/LLM-Agente-D97757?style=flat-square&logo=anthropic&logoColor=white)

---
📌 Projeto pessoal de [@netoclovis-bit](https://github.com/netoclovis-bit). Acompanhe a evolução pelos commits!
