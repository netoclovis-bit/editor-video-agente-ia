# DESIGN.md — Sofá Outlet

> Identidade visual da **Sofá Outlet** (loja de fábrica de estofados, revenda Artflex e ArtForms).
> Fonte da verdade para qualquer peça nova: página, catálogo, post, story, provador 3D.
> Tirada do Instagram da loja e já aplicada no Provador 3D. Idioma: português do Brasil.

---

## 1. Tema visual e atmosfera (Visual Theme & Atmosphere)

- **Sensação:** loja de fábrica acolhedora e confiável. Preço de fábrica, sem parecer barato. Clássico e caseiro, não "tech".
- **Modo claro (padrão):** o creme e o marrom da logo. Fundo creme quente, cartões quase brancos, ações em marrom couro.
- **Modo escuro:** o preto e dourado dos posts do Instagram. Fundo quase preto, ações em dourado.
- **Títulos com serifa** (Playfair Display) dão o ar de loja tradicional. O texto corrido é sem serifa e limpo.
- **O produto é o herói:** o sofá aparece grande, sobre um fundo em degradê suave, com bastante respiro em volta.
- **Elemento de assinatura:** a **trena amarela** que marca as medidas reais (largura, profundidade, altura). Ela comunica "medida de verdade, cabe na sua sala".

## 2. Cores e papéis (Color Palette & Roles)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` | `#f7f3e8` | `#121110` | Fundo da página |
| `--surface` | `#fffdf6` | `#1c1a17` | Cartões, painéis, campos |
| `--ink` | `#2e302b` | `#f3ede0` | Texto principal, botão do WhatsApp |
| `--muted` | `#6b665a` | `#aaa292` | Texto de apoio, legendas, rótulos |
| `--line` | `#e3dbc9` | `#342f28` | Bordas e divisórias (1 px) |
| `--brand` | `#87603a` | `#c9a35a` | Ação principal ("Ver na minha sala"), barra de progresso |
| `--brand-ink` | `#fffaf0` | `#17130b` | Texto sobre `--brand` |
| `--accent` | `#87603a` | `#d4b06a` | Item selecionado, foco, botão primário de diálogo |
| `--accent-ink` | `#fffaf0` | `#17130b` | Texto sobre `--accent` |
| `--accent-soft` | `#f1e6d2` | `#2e2617` | Fundo do item selecionado, chips |
| `--stage-a` | `#fffef8` | `#2b2823` | Centro do degradê atrás do produto |
| `--stage-b` | `#ebe3d1` | `#151412` | Borda do degradê atrás do produto |

**Cores fixas (iguais nas duas lojas):**

| Token | Valor | Uso |
|---|---|---|
| `--tape` | `#fbba00` | Trena de medidas, números dos passos, aviso de "abra no navegador" |
| `--tape-ink` | `#1a1400` | Texto sobre a trena |
| `--good` | `#23704a` (escuro `#66c891`) | "Cabe na parede" |
| `--warn` | `#93600f` (escuro `#e5a84e`) | "Cabe, mas justo" |
| `--bad` | `#a8352a` (escuro `#f08176`) | "Não cabe" |

**Contraste medido (WCAG):** texto/fundo 12:1 (escuro 16:1) · texto de apoio/fundo 5,2:1 (escuro 7,4:1) · texto no botão marrom 5,4:1 (escuro 7,8:1) · texto na trena 10,6:1. Tudo passa AA.

## 3. Tipografia (Typography Rules)

Google Fonts: `https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap`

| Papel | Fonte | Peso / tamanho | Detalhes |
|---|---|---|---|
| Nome da loja | Playfair Display | 700 · 24–32 px (celular 20 px) | `letter-spacing: 0.005em` |
| Título do produto (h1) | Playfair Display | 700 · 32–44 px | linha 1.0, `letter-spacing: -0.01em` |
| Título de seção ("MODELO", "TECIDO") | Playfair Display | 600 · 15 px | CAIXA ALTA, `letter-spacing: 0.1em` |
| Sobretítulo (tipo do produto) | Playfair Display | 600 · 14 px | CAIXA ALTA, `letter-spacing: 0.14em`, cor `--muted` |
| Texto corrido | Figtree | 400 · 15 px / 1.5 | |
| Rótulos, chips | Figtree | 600 · 12 px | CAIXA ALTA, `letter-spacing: 0.04–0.08em` |
| Botões | Figtree | 700 · 15–16 px | |
| **Medidas** | IBM Plex Mono | 600 · 12,5–16 px | números tabulares (`font-variant-numeric: tabular-nums`) |

Fontes de reserva: `Georgia, serif` (títulos) · `system-ui, sans-serif` (texto) · `ui-monospace, monospace` (medidas).

## 4. Componentes (Component Stylings)

- **Cabeçalho:** logo redonda (62 px; 46 px no celular, com anel de 1 px `--line`) + "Sofá Outlet" em Playfair + linha pequena "LOJA DE FÁBRICA · PROVADOR 3D" em caixa alta `--muted`. À direita, a logo Artflex menor (58 px; 36 px no celular), com "PRODUTOS" em caixa alta.
- **Botão principal (pílula):** fundo `--brand`, texto `--brand-ink`, 46 px de altura (40 px no celular), `border-radius: 999px`, peso 700, ícone de 19 px à esquerda, sombra `0 5px 14px rgb(0 0 0 / .2)`. Ex.: "Ver na minha sala".
- **Botão do WhatsApp:** bloco largo, 54 px de altura, raio 12 px, fundo `--ink` e texto `--bg` (escuro sobre claro, e o inverso no modo escuro), peso 700 e 16 px, com ícone de balão. Texto: "Pedir orçamento no WhatsApp".
- **Botões de alternância** (Medidas, Abrir retrátil, Reclinar): pílula de 38 px, borda 1 px `--line`, fundo `--surface` a 92% com desfoque de 6 px. Quando ligado, o fundo vira `--ink` e o texto `--bg`.
- **Chip:** pílula, 12 px, caixa alta, fundo `--accent-soft`. Ex.: "3D GERADO DAS FOTOS · MEDIDAS REAIS".
- **Cartão de opção** (modelo, tamanho, tecido): fundo `--surface`, borda 1 px `--line`, raio 12 px. **Selecionado:** borda `--accent`, fundo `--accent-soft` e contorno interno de 1 px `--accent`. Modelo: foto 16:9, nome em Playfair 16 px e tipo em 12 px `--muted`.
- **Amostra de cor:** círculo de 46 px com a foto real do tecido, sombra interna leve e nome da cor embaixo (12 px `--muted`).
- **Quadro de medidas:** três colunas (Largura · Profundidade · Altura) separadas por linhas de 1 px. Rótulo em caixa alta 11,5 px e valor em Plex Mono 16 px.
- **Trena:** linha amarela `--tape` de 2,25 px com tracinhos nas pontas. Etiqueta amarela com Plex Mono 12,5 px, raio 4 px e "régua" desenhada na base. Complemento em 10,5 px (ex.: `1,30 m reclinada`).
- **Ficha técnica:** bloco que abre e fecha (`details`), raio 12 px, título em Playfair caixa alta, lista em 14 px `--muted`.
- **"Cabe na sua sala?":** caixa com borda tracejada, campo numérico em Plex Mono e resultado com bolinha colorida (`--good` / `--warn` / `--bad`).
- **Galeria de ambientes:** miniaturas 16:9 com raio 8 px. Ao tocar, abre em tela cheia sobre fundo `rgb(8 8 8 / .92)`.

## 5. Layout (Layout Principles)

- Largura máxima de 1240 px e margem lateral mínima de 16 px (respeitando a área segura do iPhone).
- **Computador:** duas colunas, com o palco 3D (1,4 fr) fixo à esquerda e a ficha (1 fr) à direita, espaço de 28 px entre elas.
- **Celular:** uma coluna. O palco 3D fica preso no topo (46% da tela) e as opções rolam por baixo. Modelos e tecidos rolam de lado.
- Ordem no celular: Modelo → Tamanho → Tecido → Medidas → Ambientes → Ficha → Cabe? → WhatsApp.
- Espaçamentos: 6 · 8 · 10 · 12 · 16 · 22 · 28 px.
- Raios: 8 px (pequeno), 12 px (cartões), 20 px (palco e painéis grandes), 999 px (pílulas).

## 6. Profundidade (Depth & Elevation)

- Sombra padrão (claro): `0 1px 2px rgb(40 30 20 / .07), 0 8px 24px rgb(40 30 20 / .08)`.
- Sombra padrão (escuro): `0 1px 2px rgb(0 0 0 / .4), 0 8px 24px rgb(0 0 0 / .3)`.
- Palco do produto: `radial-gradient(ellipse 80% 70% at 50% 38%, var(--stage-a), var(--stage-b))`.
- Controles sobre o produto: fundo semitransparente com `backdrop-filter: blur(6px)`.
- Sombras discretas: a profundidade vem do degradê e das bordas finas, não de sombras pesadas.

## 7. Voz e textos

- Português do Brasil, frases curtas e diretas, falando com o cliente ("Ver na minha sala", "Pedir orçamento no WhatsApp").
- **Medidas sempre em metros, com vírgula e espaço:** `2,36 m`, `0,85 m`. Centímetros só em folgas (`sobram 12 cm de cada lado`).
- Medida estimada leva `≈` e a palavra "aproximada". Medida do catálogo nunca leva `≈`.
- Nomes oficiais: **Sofá Outlet** (com acento), **Artflex**, **ArtForms**. Termos do catálogo: retrátil, reclinável, módulos, chaise, assento fixo.
- Separador de informações: ponto médio ` · ` (ex.: `Loja de fábrica · Provador 3D`).
- WhatsApp da loja: **+55 (83) 92145-4788** (link `https://wa.me/5583921454788`). Mensagem padrão: "Olá, Sofá Outlet! Vi o provador 3D e quero um orçamento:" seguida de modelo, tamanho e tecido.

## 8. Faça e não faça (Do's and Don'ts)

**Faça**
- Use o marrom (`--brand`) só na ação principal de cada tela.
- Mostre o produto grande, com as medidas reais do catálogo.
- Use fotos reais dos tecidos e dos ambientes.
- Dê suporte aos modos claro e escuro com os mesmos tokens.
- Mantenha toques com pelo menos 40 px de altura no celular.

**Não faça**
- Não use o amarelo da trena para outra coisa além de medidas, passos numerados e avisos.
- Não invente medidas: se não estiver no catálogo, marque como aproximada.
- Não deixe a logo Artflex maior que a logo da loja.
- Não use outras fontes, degradês coloridos, neon ou sombras pesadas.
- Não copie o visual de outras marcas.
- Não use emojis em excesso. No máximo um, em posts.

## 9. Responsivo (Responsive Behavior)

| Faixa | Mudanças |
|---|---|
| > 900 px | Duas colunas, palco fixo de até 700 px de altura |
| ≤ 900 px | Uma coluna; palco preso no topo (280–440 px); modelos e tecidos em rolagem lateral |
| ≤ 520 px | Logo 46 px, nome 20 px, botão principal 40 px, some o subtítulo "PRODUTOS" e as dicas sobre o palco |

## 10. Guia rápido para IA (Agent Prompt Guide)

**Resumo para colar num prompt:**
> Visual da Sofá Outlet: creme `#f7f3e8` de fundo, cartões `#fffdf6`, texto `#2e302b`, ações em marrom `#87603a` com texto `#fffaf0`. No modo escuro: fundo `#121110`, texto `#f3ede0`, ações em dourado `#c9a35a`. Títulos em Playfair Display 700, texto em Figtree, medidas em IBM Plex Mono. Cantos 12 px, botões em pílula, bordas de 1 px `#e3dbc9`, sombras suaves. Medidas em metros com vírgula (`2,36 m`), marcadas em etiqueta amarela `#fbba00`. Tom acolhedor de loja de fábrica, em português.

**Exemplos de pedido:**
- "Use o DESIGN.md da Sofá Outlet e crie um post 1080×1350 do sofá Parma 3 módulos, com a medida 3,20 m na etiqueta amarela e o botão 'Peça no WhatsApp'."
- "Crie uma página de entrada para o Instagram com 3 cartões (Retráteis, Fixos, Poltronas) que levam ao provador."
- "Faça a capa de um catálogo em PDF A4 no modo escuro (preto e dourado)."

**Tokens prontos (CSS):**
```css
:root {
  --bg: #f7f3e8; --surface: #fffdf6; --ink: #2e302b; --muted: #6b665a; --line: #e3dbc9;
  --brand: #87603a; --brand-ink: #fffaf0; --accent: #87603a; --accent-ink: #fffaf0; --accent-soft: #f1e6d2;
  --stage-a: #fffef8; --stage-b: #ebe3d1;
  --tape: #fbba00; --tape-ink: #1a1400; --good: #23704a; --warn: #93600f; --bad: #a8352a;
  --font-display: "Playfair Display", Georgia, "Times New Roman", serif;
  --font-body: "Figtree", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --r-sm: 8px; --r-md: 12px; --r-lg: 20px;
  --shadow: 0 1px 2px rgb(40 30 20 / 0.07), 0 8px 24px rgb(40 30 20 / 0.08);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121110; --surface: #1c1a17; --ink: #f3ede0; --muted: #aaa292; --line: #342f28;
    --brand: #c9a35a; --brand-ink: #17130b; --accent: #d4b06a; --accent-ink: #17130b; --accent-soft: #2e2617;
    --stage-a: #2b2823; --stage-b: #151412;
    --good: #66c891; --warn: #e5a84e; --bad: #f08176;
    --shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px rgb(0 0 0 / 0.3);
  }
}
```

**Arquivos de marca (nesta pasta):**
- `loja-sofa-outlet.png`: logo da loja. Use sempre recortada em círculo, com anel fino de 1 px.
- `artflex-logo.png` / `artflex-logo-neg.png`: logo da fábrica para fundo claro / escuro. É secundária.
