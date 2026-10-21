# Como colocar o agente para cuidar do seu Instagram

Siga na ordem. Até o passo 5 nada é publicado e nada é gasto: o agente roda em
**modo simulação** e só gera as artes no seu computador para você conferir.

---

## 1. Instalar

Você precisa de **Python 3.10 ou mais novo** e do **FFmpeg** (monta os reels).

- Windows: instale o Python em python.org (marque "Add to PATH") e o FFmpeg com `winget install ffmpeg`.
- Mac: `brew install python ffmpeg`
- Linux: `sudo apt install python3 python3-pip ffmpeg`

Depois, dentro da pasta do projeto:

```bash
pip install -r requirements.txt
python -m agente_instagram iniciar
```

Isso cria dois arquivos para você preencher: `marca.yaml` e `.env`.

## 2. Contar ao agente sobre a sua loja (`marca.yaml`)

Abra o `marca.yaml` e troque os exemplos pelos dados reais:

- **loja**: nome, nicho, público, cidade, WhatsApp, tom de voz e o que *não* falar.
- **visual**: cores da marca (código como `#C2185B`), logo em `marca/logo.png`.
- **produtos**: nome, preço, descrição e **fotos reais** (coloque em `produtos/`).
  Só preencha `preco_promocional` se a promoção existir de verdade: o agente nunca inventa preço.
- **calendario**: dias, horários e quantos reels/posts/carrosséis/stories por semana.
- **anuncios**: deixe `ativo: false` por enquanto.

## 3. Chave do Claude (obrigatória)

O Claude é quem planeja os posts, escreve as legendas e conversa com você.

1. Entre em <https://console.anthropic.com>, crie a conta e adicione créditos.
2. Em **API Keys**, crie uma chave e cole no `.env`: `ANTHROPIC_API_KEY=...`

## 4. Imagens com IA (opcional)

Sem isto, as artes usam **as fotos reais dos seus produtos** sobre as cores da marca
(já fica bonito e é 100% fiel ao produto). Com isto, a IA cria cenários e coloca o
produto neles.

1. Crie uma chave em <https://platform.openai.com> (é cobrado por imagem gerada).
2. Cole no `.env`: `OPENAI_API_KEY=...`

> Dica: a IA usa a foto real como referência, mas confira as primeiras artes. Se o
> produto sair diferente do real, apague a chave e use só as fotos.

## 5. Testar em simulação

```bash
python -m agente_instagram verificar     # mostra o que está faltando
python -m agente_instagram planejar      # planeja 7 dias de conteúdo
python -m agente_instagram fila          # mostra a fila
python -m agente_instagram produzir      # gera as artes e os reels
```

As artes ficam em `dados/midia/<id do post>/`. Abra e veja se gostou. Não gostou de
algo? Converse com o agente:

```bash
python -m agente_instagram agente
```

Exemplos de pedidos:
- "Mostra o que está agendado para esta semana"
- "Troca a legenda do post a1b2c3d4 para falar da entrega no mesmo dia"
- "Cria um reels para sexta às 19h sobre a calça wide leg, mostrando 3 jeitos de usar"
- "Planeja a próxima semana com foco na promoção de Dia dos Namorados"
- "Quais posts deram mais resultado?"

---

## 6. Conectar o Instagram (Meta)

O agente usa a **API oficial da Meta**: sem senha, sem robô clicando no app, sem risco
de bloqueio por automação.

**Antes:** sua conta do Instagram precisa ser **profissional** (Comercial ou Criador de
conteúdo) e estar **vinculada a uma Página do Facebook**. No app do Instagram:
Configurações → Tipo de conta e ferramentas → Mudar para conta profissional.

**Criar o acesso:**

1. Entre em <https://business.facebook.com> e crie (ou abra) o Portfólio empresarial da loja.
   Em **Contas**, confira se a Página, a conta do Instagram e a conta de anúncios estão lá.
2. Entre em <https://developers.facebook.com> → **Meus apps** → **Criar app** → tipo
   **Empresa**, ligado ao portfólio da loja.
3. Volte ao business.facebook.com → **Configurações** → **Usuários do sistema** →
   **Adicionar** (função Administrador).
4. Clique em **Atribuir ativos** e dê controle total da Página, da conta do Instagram e da
   conta de anúncios a esse usuário.
5. Clique em **Gerar token**, escolha o app, validade **Nunca** e marque as permissões:
   `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`,
   `pages_show_list`, `pages_read_engagement`, `business_management`
   e, para anúncios, `ads_management` e `ads_read`.
6. Cole o token no `.env`: `META_ACCESS_TOKEN=...`
7. Rode `python -m agente_instagram descobrir`. Ele mostra os números de
   `INSTAGRAM_USER_ID`, `FACEBOOK_PAGE_ID` e `META_AD_ACCOUNT_ID`. Copie para o `.env`.
8. Rode `python -m agente_instagram verificar`: deve aparecer `Conectado a @sualoja`.

> Guarde o token como uma senha. Se vazar, gere outro no mesmo lugar e o antigo deixa de valer.

## 7. Hospedar as mídias (Cloudinary, grátis para começar)

A API do Instagram não recebe o arquivo direto: ela baixa de um link público.

1. Crie a conta em <https://cloudinary.com>.
2. No painel (Dashboard) copie **Cloud name**, **API Key** e **API Secret** para o `.env`
   (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).

Já tem site com hospedagem própria? Use `MIDIA_HOST=pasta_publica` (veja o `.env.exemplo`).

## 8. Ligar de verdade

No `.env`, troque para `MODO_SIMULACAO=false`. Teste publicando um post da fila:

```bash
python -m agente_instagram publicar --id <id do post>
```

Quer conferir tudo antes de sair? No `marca.yaml` use
`aprovar_antes_de_publicar: true` e aprove cada post com
`python -m agente_instagram aprovar <id>` (ou pedindo ao agente).

## 9. Deixar no automático

A `rotina` faz tudo sozinha: publica no horário, planeja a semana seguinte quando a fila
está acabando, gera as artes 48 h antes, lê as métricas e cuida dos anúncios.
Ela precisa rodar **de hora em hora**. Escolha um jeito:

### Opção A — GitHub Actions (não precisa deixar computador ligado)

1. Deixe o repositório **privado** (a fila e o `marca.yaml` ficam salvos nele).
2. Suba o `marca.yaml`, o logo e as fotos dos produtos para o repositório
   (o `.env` **nunca**: ele já está no `.gitignore`).
3. Em **Settings → Secrets and variables → Actions**:
   - aba **Secrets**: crie um segredo para cada chave do `.env`
     (`ANTHROPIC_API_KEY`, `META_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`, `FACEBOOK_PAGE_ID`,
     `META_AD_ACCOUNT_ID`, `OPENAI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
     `CLOUDINARY_API_SECRET`);
   - aba **Variables**: `AGENTE_ATIVO` = `true` e `MODO_SIMULACAO` = `false`.
4. Pronto: o workflow **Agente Instagram** roda de hora em hora. Dá para rodar na mão em
   **Actions → Agente Instagram → Run workflow**.

### Opção B — no seu computador ou servidor

Linux/Mac (`crontab -e`):

```
17 * * * * cd /caminho/do/projeto && python3 -m agente_instagram rotina >> rotina.log 2>&1
```

Windows: Agendador de Tarefas, repetindo a cada 1 hora o comando
`python -m agente_instagram rotina` na pasta do projeto.

---

## 10. Tráfego pago (anúncios)

O agente impulsiona automaticamente os posts que **já foram bem no orgânico** (melhor
taxa de engajamento da semana) e depois vigia as campanhas:

- pausa a campanha se o custo por clique passar de `cpc_max` ou a taxa de cliques ficar
  abaixo de `ctr_min` (só depois de gastar `gasto_min_para_avaliar`);
- aumenta o orçamento em `aumento_percentual` quando o clique está barato;
- pausa tudo se o gasto do mês chegar no `orcamento_mensal_max`.

**Travas de segurança (não dá para a IA passar por cima):**

| Trava | Onde |
|---|---|
| Liga/desliga geral | `anuncios.ativo` |
| Máximo por campanha por dia | `orcamento_diario_max` |
| Máximo somando todas as campanhas | `orcamento_diario_total_max` |
| Teto do mês (gasto real + previsão) | `orcamento_mensal_max` |
| Campanha nasce pausada esperando você | `ativar_automaticamente: false` |

Recomendação para começar:

1. No `marca.yaml`: `ativo: true`, `ativar_automaticamente: false`, limites baixos.
2. Quando o agente criar uma campanha, veja com `python -m agente_instagram anuncios status`
   e ligue com `python -m agente_instagram anuncios aprovar <id da campanha>`.
3. Depois de algumas semanas confiando nos resultados, se quiser, mude
   `ativar_automaticamente: true`.

Outros comandos:

```bash
python -m agente_instagram anuncios impulsionar <id do post> --orcamento 15 --dias 5
python -m agente_instagram anuncios pausar <id da campanha>
python -m agente_instagram anuncios otimizar
```

A conta de anúncios precisa ter forma de pagamento cadastrada no Gerenciador de Anúncios.

---

## Limitações que vale saber

- **Música dos reels:** a API não acessa a biblioteca de músicas do Instagram. Coloque um
  MP3 livre de direitos em `reels.musica` no `marca.yaml`; sem ele, o reels sai sem som.
- **Stories pela API** não têm figurinhas, enquetes nem links clicáveis.
- **Métricas** levam algumas horas para aparecer; a rotina atualiza uma vez por dia.
- **Comentários e directs** ainda não são respondidos pelo agente.

## Problemas comuns

| Mensagem | O que fazer |
|---|---|
| `Falta a chave do Claude` | Preencha `ANTHROPIC_API_KEY` no `.env`. |
| `Hospedagem de mídia não configurada` | Faça o passo 7. |
| `Token expirado` / `Error validating access token` | Gere um novo token (passo 6.5) com validade "Nunca". |
| `Application does not have permission` | Faltou marcar alguma permissão no token (passo 6.5). |
| `O Instagram não conseguiu processar a mídia` | Rode `produzir --id <id>` de novo; se continuar, veja se o link da mídia abre no navegador. |
| Post com status `erro` | `python -m agente_instagram fila` mostra o motivo. Corrija e use `publicar --id <id>`. |
