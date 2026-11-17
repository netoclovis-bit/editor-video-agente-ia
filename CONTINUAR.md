# Provador 3D — guia para continuar o trabalho

Provador de sofás em 3D e realidade aumentada para duas lojas que revendem Artflex e ArtForms:
**Sofá Outlet** e **Decorart Ambientes**. O cliente abre o link (Instagram), escolhe modelo,
tamanho e tecido, vê o 3D com as medidas reais do catálogo, coloca na sala pela câmera
("Ver na minha sala") e pede orçamento no WhatsApp da loja.

Se você é o Claude continuando este trabalho: leia este arquivo inteiro antes de mexer em algo.

## Onde está cada coisa

| O quê | Onde |
|---|---|
| Site publicado | https://projeto-3d.pages.dev (`/sofa-outlet`, `/decorart`) |
| Arquivos do site (o que vai ao ar) | ramo **`provador-site`** deste repositório |
| Fontes (este ramo) | ramo **`provador-fonte`** |
| Hospedagem | Cloudflare Pages, projeto **projeto-3d**, ligado ao ramo `provador-site`: cada `git push` nele publica sozinho em ~1 minuto |
| Identidade das lojas | `design/sofa-outlet/DESIGN.md` e `design/decorart/DESIGN.md` (cores, fontes, componentes, tom) |

Neste ramo:
- `provador-base.html` — a página do provador (produtos, tecidos, 3D, trena, WhatsApp). **Toda mudança de página começa aqui.**
- `tools/lojas.py` — gera a página de cada loja a partir da base (troca cores, fontes, logo e WhatsApp).
- `tools/publicar.py` — gera `sofa-outlet.html` e `decorart.html` prontas para o site.
- `ia-original/` — os 22 modelos 3D gerados por IA (Hunyuan3D, só forma), antes de qualquer ajuste.
- `tools/*.mjs` — o tratamento dos modelos (abaixo).
- `harness/` — páginas e scripts de teste (Playwright) para renderizar os 3D e a página.

## Publicar uma mudança na página

```bash
git worktree add ../provador-site provador-site      # uma vez
# edite provador-base.html
python tools/publicar.py provador-base.html ../provador-site
cd ../provador-site && git add -A && git commit -m "O que mudou" && git push
```

Um modelo 3D novo ou refeito: copie o `.glb` para a pasta do site com o mesmo nome que a página usa
(`arquivo:` em `MODELOS` dentro de `provador-base.html`) e faça o commit junto.

## Tratamento dos modelos 3D

Instale uma vez: `cd tools && npm install` (Node 20+).

| Ferramenta | Uso | O que faz |
|---|---|---|
| `process-ia.mjs` | `node tools/process-ia.mjs ia-original saida [ids...]` | Ajusta o modelo da IA às medidas do catálogo (`CFG` no topo: largura, fundo, altura), separa tecido / madeira / plástico, assa sombras (AO), aplica textura. Também gera versões derivadas (tirar um módulo, espelhar). |
| `build-reclina.mjs` | `node tools/build-reclina.mjs saida/doha-085.glb doha-085-rec.glb doha` (ou `dalian`) | Poltronas Doha e Dalian reclinando (encosto + apoio de pés, animação "Abrir"). Usa o modelo já tratado. |
| `build-canto.mjs` | `node tools/build-canto.mjs saida/lazio-336.glb lazio-canto-308.glb` | Lazio de canto em L (3,08 × 3,08 m); `espelhado` como 3º argumento faz a chaise à esquerda. |
| `build-catalog.mjs` | `node tools/build-catalog.mjs saida valencia-250 parma-230 parma-320 versalhes-182 ibiza-210` | Retráteis modelados (Valência, Parma, Versalhes, Ibiza) com o assento abrindo, o encosto acompanhando e a almofada lombar apoiada no assento. |

Para ver um 3D: sirva `harness/render` (`python -m http.server 8765`, com `model-viewer.min.js` e o `.glb` na pasta) e use `harness/render/shot.cjs`.

## Próximo trabalho pedido (teste do "Ver na minha sala" no iPhone)

O dono testou no quarto e aprovou. Pediu para melhorar a qualidade de cada peça:

1. ~~**Puff Belle** — o tecido cobre o alto dos pés de madeira.~~ Feito: opção `posts` em `CFG`.
2. ~~**Poltronas com moldura de madeira (Ágata, Topázio, Safira, Itália, Melissa)** — manchas de tecido sobre a madeira.~~ Feito: opção `refine` (corte mínimo que leva a fronteira madeira/tecido para os vincos, sem serrilhado; o pé cortado reto em `legTop`). Rubi e Pérola com o topo do pé reto; Melissa com os pés subindo até o braço (`sidePost`).
3. **Dalian** — superfície do braço e da lateral com amassados e "rasgos" na textura; falta acabamento em detalhes. Suavizar a malha nessas regiões ou refazer o modelo.
4. **Pés faltando ou tecido por cima da madeira** nos sofás: revisar um por um.

Para conferir a madeira/tecido de um modelo: `node tools/mapax.mjs saida/modelo.glb` (mapa de altura × profundidade com o material da face mais de fora) e `node tools/fatias.mjs saida/modelo.glb 0.1 0.4` (onde o pé vira corpo).
5. Para peças que a IA errou na forma, **gerar de novo** no PC (RTX 3060, 12 GB) com **Hunyuan3D-2mv** (várias fotos: frente, lado, costas), em vez de uma foto só. Depois passar pelo `process-ia.mjs`.

Ideia para o futuro: **PartCrafter** gera o móvel já separado em peças (encosto, assento, braços), o que deixaria as animações de reclinar e abrir mais perfeitas.

## Detalhes que importam

- Medidas sempre as do catálogo Artflex/ArtForms 2026. Medida estimada (poltrona reclinada) aparece com "≈".
- Dalian só sai em courino (Texcouro); Dalian tem versão manual e elétrica com massageador.
- WhatsApp: Sofá Outlet (83) 92145-4788; Decorart (83) 99879-9800.
- "Ver na minha sala" só funciona no navegador do celular (Chrome/Safari), não dentro do Instagram; a página avisa.
- Um link pode abrir direto num modelo: `/sofa-outlet#versalhes`.
