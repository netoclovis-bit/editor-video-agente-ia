# DESIGN.md — Decorart Ambientes

> Identidade visual da **Decorart Ambientes** (loja de móveis e decoração, revenda Artflex e ArtForms).
> Fonte da verdade para qualquer peça nova: página, catálogo, post, story, provador 3D.
> Tirada do Instagram da loja e já aplicada no Provador 3D. Idioma: português do Brasil.

---

## 1. Tema visual e atmosfera (Visual Theme & Atmosphere)

- **Sensação:** loja de decoração moderna e elegante. Ambientes montados, bom gosto, sem exagero.
- **Modo claro (padrão):** fundo off-white quente, cartões brancos, texto e botões quase pretos. O marrom do "D" da marca entra nos destaques e no item selecionado.
- **Modo escuro:** fundo preto com detalhes em caramelo, como os posts da loja.
- **Títulos em Montserrat**, em caixa alta e com espaçamento largo no nome da loja ("DECORART"). Visual geométrico e limpo.
- **O produto é o herói:** o sofá aparece grande, sobre um fundo neutro em degradê, com bastante respiro.
- **Elemento de assinatura (do provador):** a **trena amarela** com as medidas reais. Ela é a única cor viva da página.

## 2. Cores e papéis (Color Palette & Roles)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` | `#f6f4f1` | `#111010` | Fundo da página |
| `--surface` | `#ffffff` | `#1b1918` | Cartões, painéis, campos |
| `--ink` | `#1b1814` | `#f2ece4` | Texto principal, botão do WhatsApp |
| `--muted` | `#6a6157` | `#a99e92` | Texto de apoio, legendas, rótulos |
| `--line` | `#e4ddd4` | `#332e2a` | Bordas e divisórias (1 px) |
| `--brand` | `#1b1814` | `#c19d73` | Ação principal ("Ver na minha sala"), barra de progresso |
| `--brand-ink` | `#f3e6d4` | `#1b1209` | Texto sobre `--brand` (creme sobre preto; escuro sobre caramelo) |
| `--accent` | `#5e3a1b` | `#d3b38c` | Marrom do "D": item selecionado, foco, botão primário de diálogo |
| `--accent-ink` | `#ffffff` | `#1b1209` | Texto sobre `--accent` |
| `--accent-soft` | `#f1e8dd` | `#2c2219` | Fundo do item selecionado, chips |
| `--stage-a` | `#ffffff` | `#2a2725` | Centro do degradê atrás do produto |
| `--stage-b` | `#e7e2db` | `#141312` | Borda do degradê atrás do produto |

**Cores fixas (iguais nas duas lojas):**

| Token | Valor | Uso |
|---|---|---|
| `--tape` | `#fbba00` | Trena de medidas, números dos passos, aviso de "abra no navegador" |
| `--tape-ink` | `#1a1400` | Texto sobre a trena |
| `--good` | `#23704a` (escuro `#66c891`) | "Cabe na parede" |
| `--warn` | `#93600f` (escuro `#e5a84e`) | "Cabe, mas justo" |
| `--bad` | `#a8352a` (escuro `#f08176`) | "Não cabe" |

**Contraste medido (WCAG):** texto/fundo 16:1 · texto de apoio/fundo 5,5:1 (escuro 7,2:1) · creme sobre botão preto 14,4:1 · texto no botão caramelo 7,3:1 · branco sobre marrom 10:1 · texto na trena 10,6:1. Tudo passa AA.

## 3. Tipografia (Typography Rules)

Google Fonts: `https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap`

| Papel | Fonte | Peso / tamanho | Detalhes |
|---|---|---|---|
| Nome da loja ("DECORART") | Montserrat | 700 · 24–32 px (celular 20 px) | CAIXA ALTA, `letter-spacing: 0.08em`, linha 1.0 |
| Título do produto (h1) | Montserrat | 700 · 32–44 px | linha 1.0, `letter-spacing: -0.01em` |
| Título de seção ("MODELO", "TECIDO") | Montserrat | 600 · 15 px | CAIXA ALTA, `letter-spacing: 0.1em` |
| Sobretítulo (tipo do produto) | Montserrat | 600 · 14 px | CAIXA ALTA, `letter-spacing: 0.14em`, cor `--muted` |
| Texto corrido | Figtree | 400 · 15 px / 1.5 | |
| Rótulos, chips | Figtree | 600 · 12 px | CAIXA ALTA, `letter-spacing: 0.04–0.08em` |
| Botões | Figtree | 700 · 15–16 px | |
| **Medidas** | IBM Plex Mono | 600 · 12,5–16 px | números tabulares (`font-variant-numeric: tabular-nums`) |

Fontes de reserva: `"Helvetica Neue", Arial, sans-serif` (títulos) · `system-ui, sans-serif` (texto) · `ui-monospace, monospace` (medidas).

## 4. Componentes (Component Stylings)

- **Cabeçalho:** marca "D" (62 px; 46 px no celular) + "DECORART" em Montserrat caixa alta + linha pequena "AMBIENTES · PROVADOR 3D" em caixa alta `--muted`. No modo claro, use a marca "D" sem fundo; no escuro, a logo redonda do Instagram, com anel de 1 px. À direita, a logo Artflex menor (58 px; 36 px no celular), com "PRODUTOS".
- **Botão principal (pílula):** fundo `--brand` (preto no claro, caramelo no escuro), texto `--brand-ink`, 46 px de altura (40 px no celular), `border-radius: 999px`, peso 700, ícone de 19 px à esquerda, sombra `0 5px 14px rgb(0 0 0 / .2)`. Ex.: "Ver na minha sala".
- **Botão do WhatsApp:** bloco largo, 54 px de altura, raio 12 px, fundo `--ink` e texto `--bg`, peso 700 e 16 px, com ícone de balão. Texto: "Pedir orçamento no WhatsApp".
- **Botões de alternância** (Medidas, Abrir retrátil, Reclinar): pílula de 38 px, borda 1 px `--line`, fundo `--surface` a 92% com desfoque de 6 px. Quando ligado, o fundo vira `--ink` e o texto `--bg`.
- **Chip:** pílula, 12 px, caixa alta, fundo `--accent-soft`. Ex.: "3D GERADO DAS FOTOS · MEDIDAS REAIS".
- **Cartão de opção** (modelo, tamanho, tecido): fundo `--surface`, borda 1 px `--line`, raio 12 px. **Selecionado:** borda `--accent` (marrom do "D"), fundo `--accent-soft` e contorno interno de 1 px `--accent`. Modelo: foto 16:9, nome em Montserrat 16 px e tipo em 12 px `--muted`.
- **Amostra de cor:** círculo de 46 px com a foto real do tecido, sombra interna leve e nome da cor embaixo (12 px `--muted`).
- **Quadro de medidas:** três colunas (Largura · Profundidade · Altura) separadas por linhas de 1 px. Rótulo em caixa alta 11,5 px e valor em Plex Mono 16 px.
- **Trena:** linha amarela `--tape` de 2,25 px com tracinhos nas pontas. Etiqueta amarela com Plex Mono 12,5 px, raio 4 px e "régua" desenhada na base. Complemento em 10,5 px (ex.: `1,40 m aberto`).
- **Ficha técnica:** bloco que abre e fecha (`details`), raio 12 px, título em Montserrat caixa alta, lista em 14 px `--muted`.
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
- Visual plano e limpo: a profundidade vem do degradê e das bordas finas, não de sombras pesadas.

## 7. Voz e textos

- Português do Brasil, frases curtas e diretas, falando com o cliente ("Ver na minha sala", "Pedir orçamento no WhatsApp"). Tom de loja de decoração: elegante, sem exagero.
- **Medidas sempre em metros, com vírgula e espaço:** `2,36 m`, `0,85 m`. Centímetros só em folgas (`sobram 12 cm de cada lado`).
- Medida estimada leva `≈` e a palavra "aproximada". Medida do catálogo nunca leva `≈`.
- Nomes oficiais: **Decorart Ambientes** (no cabeçalho, "DECORART" + "AMBIENTES"), **Artflex**, **ArtForms**. Termos do catálogo: retrátil, reclinável, módulos, chaise, assento fixo.
- Separador de informações: ponto médio ` · ` (ex.: `Ambientes · Provador 3D`).
- WhatsApp da loja: **+55 (83) 99879-9800** (link `https://wa.me/5583998799800`). Mensagem padrão: "Olá, Decorart Ambientes! Vi o provador 3D e quero um orçamento:" seguida de modelo, tamanho e tecido.

## 8. Faça e não faça (Do's and Don'ts)

**Faça**
- Deixe a página quase toda em neutros (off-white, branco, preto). O marrom do "D" vai só no que está selecionado ou em destaque.
- Use a ação principal em preto (claro) ou caramelo (escuro), uma por tela.
- Mostre o produto grande, com as medidas reais do catálogo.
- Use fotos reais dos tecidos e dos ambientes.
- Dê suporte aos modos claro e escuro com os mesmos tokens.
- Mantenha toques com pelo menos 40 px de altura no celular.

**Não faça**
- Não use o amarelo da trena para outra coisa além de medidas, passos numerados e avisos.
- Não invente medidas: se não estiver no catálogo, marque como aproximada.
- Não use a fonte com serifa da Sofá Outlet (Playfair): ela é da outra loja.
- Não deixe a logo Artflex maior que a marca da loja.
- Não use cores vivas, degradês coloridos ou sombras pesadas.
- Não copie o visual de outras marcas.
- Não use emojis em excesso. No máximo um, em posts.

## 9. Responsivo (Responsive Behavior)

| Faixa | Mudanças |
|---|---|
| > 900 px | Duas colunas, palco fixo de até 700 px de altura |
| ≤ 900 px | Uma coluna; palco preso no topo (280–440 px); modelos e tecidos em rolagem lateral |
| ≤ 520 px | Marca 46 px, nome 20 px, botão principal 40 px, some o subtítulo "PRODUTOS" e as dicas sobre o palco |

## 10. Guia rápido para IA (Agent Prompt Guide)

**Resumo para colar num prompt:**
> Visual da Decorart Ambientes: fundo off-white `#f6f4f1`, cartões brancos, texto quase preto `#1b1814`. Ação principal em pílula preta com texto creme `#f3e6d4`. Destaques e seleção no marrom do "D", `#5e3a1b`, sobre `#f1e8dd`. No modo escuro: fundo `#111010`, texto `#f2ece4`, ações em caramelo `#c19d73`. Títulos em Montserrat 700 (nome da loja em caixa alta com espaçamento 0.08em), texto em Figtree, medidas em IBM Plex Mono. Cantos 12 px, bordas de 1 px `#e4ddd4`, sombras suaves. Medidas em metros com vírgula (`2,36 m`), em etiqueta amarela `#fbba00`. Tom elegante de loja de decoração, em português.

**Exemplos de pedido:**
- "Use o DESIGN.md da Decorart e crie um post 1080×1350 do sofá Lazio de canto, com as medidas 3,08 m × 3,08 m na etiqueta amarela e o botão 'Peça no WhatsApp'."
- "Crie uma página de entrada para o Instagram com 3 cartões (Retráteis, Fixos, Poltronas) que levam ao provador."
- "Faça a capa de um catálogo em PDF A4 no modo escuro (preto e caramelo)."

**Tokens prontos (CSS):**
```css
:root {
  --bg: #f6f4f1; --surface: #ffffff; --ink: #1b1814; --muted: #6a6157; --line: #e4ddd4;
  --brand: #1b1814; --brand-ink: #f3e6d4; --accent: #5e3a1b; --accent-ink: #ffffff; --accent-soft: #f1e8dd;
  --stage-a: #ffffff; --stage-b: #e7e2db;
  --tape: #fbba00; --tape-ink: #1a1400; --good: #23704a; --warn: #93600f; --bad: #a8352a;
  --font-display: "Montserrat", "Helvetica Neue", Arial, sans-serif;
  --font-body: "Figtree", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --r-sm: 8px; --r-md: 12px; --r-lg: 20px;
  --shadow: 0 1px 2px rgb(40 30 20 / 0.07), 0 8px 24px rgb(40 30 20 / 0.08);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111010; --surface: #1b1918; --ink: #f2ece4; --muted: #a99e92; --line: #332e2a;
    --brand: #c19d73; --brand-ink: #1b1209; --accent: #d3b38c; --accent-ink: #1b1209; --accent-soft: #2c2219;
    --stage-a: #2a2725; --stage-b: #141312;
    --good: #66c891; --warn: #e5a84e; --bad: #f08176;
    --shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px rgb(0 0 0 / 0.3);
  }
}
```

**Arquivos de marca (nesta pasta):**
- `loja-decorart-marca.png`: marca "D" sem fundo, para o modo claro.
- `loja-decorart.png`: logo redonda do Instagram, para o modo escuro. Use recortada em círculo, com anel fino de 1 px.
- `artflex-logo.png` / `artflex-logo-neg.png`: logo da fábrica para fundo claro / escuro. É secundária.
