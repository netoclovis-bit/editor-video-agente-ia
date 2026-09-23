# 🎬 Editor de Vídeo com Agente de IA

> Um editor de vídeo que você controla **conversando**: diga o que quer e o agente faz os cortes, as legendas e a montagem.

![Status](https://img.shields.io/badge/status-em_desenvolvimento-yellow?style=flat-square)
![IA](https://img.shields.io/badge/IA-Agentes_·_LLM-blueviolet?style=flat-square)

---

## 💡 A ideia

Editar vídeo toma muito tempo. Este projeto cria um **agente de IA** que entende comandos em texto, como *"corta os silêncios, coloca legenda e deixa em formato Reels"*, e executa a edição automaticamente.

## ✨ Funcionalidades planejadas

- [ ] 🗣️ **Edição por comando de texto**
- [ ] ✂️ **Cortes automáticos** (silêncios, erros, partes repetidas)
- [ ] 💬 **Legendas automáticas** (transcrição com IA)
- [ ] 📝 **Montagem a partir de roteiro** usando o material bruto
- [ ] 🎨 **Elementos animados** (títulos, destaques, lower thirds)
- [ ] 🧠 **Sugestões de melhoria** feitas pela IA
- [ ] 📱 Exportação em formatos para redes sociais (9:16, 1:1, 16:9)

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

## 🛠️ Stack prevista

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=flat-square&logo=ffmpeg&logoColor=white)
![LLM](https://img.shields.io/badge/LLM-Agente-D97757?style=flat-square&logo=anthropic&logoColor=white)

---
📌 Projeto pessoal de [@netoclovis-bit](https://github.com/netoclovis-bit). Acompanhe a evolução pelos commits!
