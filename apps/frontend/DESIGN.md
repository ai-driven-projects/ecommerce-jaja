# já já — design (leia antes de escrever qualquer tela)

Direção: **quente, arredondado e direto**. Papel creme, cartões brancos com
borda suave, pílulas para toda ação, laranja como única cor de ação e verde
para "entrega / ok". A referência visual está em `openspec/extras/design/*.dc.html`.

## Tokens (CSS custom properties em `src/app/globals.css`)
- Superfícies: `--paper #FAF8F5` (fundo da página) · `--card #FFFFFF` (cartões,
  cabeçalho, rodapé) · `--surface #F6F1EA` (campos, chips, blocos de apoio) ·
  `--line #EFE9E2` (todas as bordas e réguas, sempre **1px**).
- Texto: `--ink #1E1812` · `--ink-soft #5C544B` (parágrafos) · `--muted-ink
  #8A8177` (legendas, unidades) · `--placeholder #B8AFA4`.
- Marca: `--brand #FF6B00` · hover `--brand-strong #E85F00` · link hover
  `--brand-link #D95B00` · `--brand-light #FF8A3D` (destaque sobre escuro) ·
  `--brand-soft #FFF1E6` (fundo de chip/badge ativo) · `--brand-pale #FFD9BD`.
- Estados: verde `--success #0E9F5D` / `--success-soft #E7F6EE` (ETA, entrega,
  em estoque, grátis) · amarelo `--warning #B78A00` / `--warning-soft #FFF7DD`
  (separando, estoque baixo) · vermelho `--danger #C93A31` / `--danger-soft
  #FDEBEA` (atrasado, erro, esgotado).
- Escuro: `--dark #1E1812` para hero, bloco de ETA e sidebar do admin; texto
  secundário sobre escuro em `--dark-muted #B8AFA4`.
- Tons pastéis das áreas de imagem: `--tint-blue`, `--tint-purple`,
  `--tint-mint`, `--tint-yellow`, `--tint-peach`, `--tint-green`. Cada
  categoria raiz tem o seu, com um emoji (ver `category-art.ts`), usados na
  ilustração de reserva da área de imagem.
- Raios: **pílula (999px)** em botões, chips, campos de busca, badges e
  steppers · **12px** em inputs e itens de menu · **18–24px** em cartões, hero e
  gaveta · 10–14px em quadradinhos de ícone.
- Sombras: `shadow-card` só em hover de cartão clicável · `shadow-brand` no
  botão primário · `shadow-float` em menus, toasts e selos sobre o mapa ·
  `shadow-drawer` na gaveta do carrinho. Nada mais tem sombra em repouso.

Tailwind: `bg-paper`, `bg-card`, `bg-surface`, `border-line`, `text-ink`,
`text-muted-ink`, `bg-brand`, `text-success`, `rounded-pill`, `rounded-2xl`,
`shadow-card`, `font-display`, `animate-pulse-soft`.

## Tipografia
- **Manrope** (variável, 400–800) para todo o texto e UI. Pesos: 400 corpo,
  600/700 rótulos e nomes, 800 botões, preços e badges.
- **Bricolage Grotesque** (`font-display`, 700/800, tracking negativo) só para
  display: logo, `h1`/`h2` de página e de seção, títulos de cartão, preço
  grande do produto, valor dos KPIs e o contador de ETA.
- Números (preço, ETA, KPI) em `font-extrabold tabular-nums`; preço sempre no
  formato `R$ 1.290,90` via `formatPrice`. Em oferta, preço atual em laranja e o
  anterior riscado em `--placeholder`.
- Sem caixa alta decorativa. A única exceção são cabeçalhos de tabela e
  rótulos de grupo (`text-xs font-extrabold uppercase tracking-[0.04em]`).

## Regras
- Cor de ação é só o laranja: botão primário, "+" de adicionar, chip ativo,
  link "Ver tudo →", item ativo da sidebar. Verde é informação positiva
  (ETA, grátis, em estoque), nunca ação.
- Botão primário: pílula laranja com texto branco 800 e `shadow-brand`.
  Secundário/outline: branco ou creme com borda `--line`. Perigo: vermelho.
  Escuro (`variant="dark"`): só em cima de fundos claros muito vazios.
- Bordas sempre 1px em `--line` (1.5px em inputs e no "+" de contorno). Nunca
  bordas escuras.
- Ícones: Lucide, traço 2–2.5px, tamanho 16–18px. **Emoji** nos quadradinhos
  de KPI e nas ilustrações de estado vazio.
- Imagem do produto: a **foto real**, inteira (`next/image` com
  `object-contain`), sobre branco com respiro interno e texto alternativo igual
  ao nome; miniatura nos cards e imagem grande na galeria. O emoji grande sobre
  o tom pastel da categoria raiz é só **reserva**: produto sem foto ou foto que
  não carrega (categoria sem ilustração própria usa 🛒 sobre `--tint-green`).
- Transições só em hover/estado, ≤150ms. Cartão clicável: `-translate-y-0.5`
  + `shadow-card`. A única animação contínua é o ponto verde pulsando
  (`animate-pulse-soft`) em "entregadores online" / "a caminho".
- Foco de teclado: `outline: 2px solid var(--brand); offset 2px` (global).
  Inputs trocam a borda para laranja no foco e não mostram outline.
- Carregando: a estrutura da página com blocos creme estáticos
  (`bg-surface`, mesmos raios). Sem shimmer, sem spinner.
- Texto dependente do relógio (janela de chegada, saudação, horários) só
  entra depois da hidratação via `useClientMinute`; o servidor renderiza a
  estrutura com "…".

## Vitrine (`/`)
- Cabeçalho fixo branco com borda inferior: logo (bloco laranja com a bike +
  "já já" em Bricolage 800), **pílula de entrega** creme com relógio verde
  ("Entrega em ~18 min · Aldeota", abre menu de bairros), **busca** em pílula
  creme, "Entrar" em contorno (ou pílula com o primeiro nome + menu "Sair") e
  o botão laranja **Carrinho** com o contador em branco.
- Busca do cabeçalho: "Buscar papel A4, toner, café…"; a lupa (ou Enter)
  envia e o "×" limpa o texto. Leva a `/?q=<termo>` mantendo só o bairro
  (também a partir do detalhe); vazio remove a busca. O campo mostra o `q` da
  URL, inclusive depois de recarregar.
- Chips de categoria em pílulas brancas roláveis: "Tudo" + as raízes do
  catálogo, com o emoji da raiz; a ativa fica laranja sobre pêssego. Categoria
  com filhas abre uma segunda linha de chips menores ("Tudo em <Categoria>" +
  subcategorias com a contagem em cinza); numa neta, as linhas da raiz e do pai
  continuam visíveis. Estado na URL (`categoria` por slug), junto com `bairro`.
- Página inicial (sem busca, filtros nem categoria), nesta ordem:
  - hero escuro (raio 24): badge translúcido, título em Bricolage com "em
    minutos." em `--brand-light`, CTA "Pedir agora", ponto verde pulsando com
    entregadores online e dois cartões brancos de "pedidos ao vivo";
  - "Em destaque" (12 produtos) e "Ofertas da semana" (8, do maior desconto,
    cards de 220px): título em Bricolage 24px e "Ver tudo →" laranja à
    direita, levando à listagem filtrada;
  - "Categorias em destaque": até 12 cartões brancos (raio 18) com o emoji no
    quadradinho pastel da raiz, o nome e "N produtos".
  Seção sem itens não aparece.
- Listagem (com busca, filtros ou categoria):
  - título em Bricolage 30 ("Resultados para “termo”", o nome da categoria
    com as ancestrais clicáveis acima, "Em destaque" ou "Ofertas") e
    "N produtos" em cinza; à direita, a ordenação num seletor em pílula
    ("Mais relevantes" só com busca, "Destaques", "Menor preço", "Maior
    preço", "Nome (A–Z)", "Maior desconto");
  - filtros (Marca com contagem e "Ver todas" depois de 8, Preço em reais com
    "Aplicar", Só ofertas, Só destaques) com rótulos de grupo em caixa alta
    pequena, numa coluna branca de 260px em `lg` e, abaixo disso, no botão
    "Filtros (n)" que abre um painel lateral com os mesmos controles;
  - filtros ativos em pílulas pêssego com "×" e o link "Limpar filtros";
  - grade de cards seguida da paginação; trocar de página leva ao topo da
    listagem;
  - carregando: blocos creme na primeira carga e opacidade reduzida nas
    seguintes; vazio: "Nada por aqui. Já já." com a sugestão de limpar os
    filtros ou buscar outro termo; erro: mensagem com "Tentar de novo".
- Card de produto: branco, raio 18, padding 12; área de imagem (120px) com a
  foto sobre branco (ou o emoji pastel de reserva) e um único selo no canto,
  nesta prioridade: `−N%` laranja, "Destaque" e o ETA branco; nome 700 em até
  3 linhas (o nome inteiro no `title`), unidade cinza e preço 800. O "+"
  redondo laranja em contorno, que vira o stepper `− n +` (pêssego) quando o
  item está no carrinho, só aparece onde a página oferece carrinho: a vitrine
  e o detalhe ainda não o exibem.
- Rodapé branco: wordmark + horário, "Áreas atendidas" em pílulas creme e o
  link discreto "Área administrativa".
- Bairro não atendido: cartão branco com "Ainda não chegamos aí. Já já." em
  display e os bairros atendidos em pílulas clicáveis, agrupados por loja, em
  qualquer modo (página inicial ou listagem).

## Carrinho (gaveta)
- Painel branco de 400px à direita, canto interno de 22px, `shadow-drawer`;
  título "Seu carrinho" em Bricolage; faixa verde "Saindo de bike · chega em
  ~X min"; itens com emoji pastel, nome, preço unitário, stepper pequeno e o
  total da linha; rodapé com subtotal, "Entrega de bike" (**Grátis** em verde
  acima de R$ 79, senão R$ 4,90), total e o botão "Finalizar pedido · R$ X".
- Persistido em `localStorage` (`jaja.cart`) via store externo com
  `useSyncExternalStore`: servidor e hidratação veem o carrinho vazio.

## Detalhe do produto (`/p/:slug`)
- Caminho "Início / <categorias da raiz à folha> / Nome" em cinza, o nome em
  negrito; cada categoria leva à listagem dela. À direita, "← Voltar aos
  resultados" em laranja quando a URL tem busca ou filtros. Produto
  inexistente ou inativo é 404; o título da aba é "<nome> — já já".
- Duas colunas (galeria 1.05fr / info 1fr). Galeria: imagem principal
  quadrada (raio 24, borda `--line`) com a foto grande sobre branco e o selo
  "Chega em ~X min"; com mais de uma imagem, setas redondas brancas nas
  laterais, contador "n/total" no canto e miniaturas de 72px de todas as
  imagens, roláveis na horizontal, a ativa com borda laranja 2px (setas do
  teclado navegam entre elas). Com uma imagem, sem setas, contador nem
  miniaturas; sem imagens, o emoji da categoria sobre o tom pastel.
- Coluna de informação: badges "Em destaque" e `−N%`, a marca como link
  laranja para a listagem da marca, `h1` em Bricolage 32, unidade e
  "Cód. <sku>" em cinza, preço 34px em Bricolage com o "De:" riscado, stepper
  grande (creme) + botão "Adicionar · R$ total", cartão de entrega (bike verde
  + caminhão laranja: ETA e a regra do frete grátis), "Sobre o produto"
  (quebras de linha preservadas; acima de 600 caracteres, recolhido com "Ler
  mais"/"Ler menos") e a ficha (Marca, Categoria, Código, Unidade) em pares
  `rótulo · valor` sobre blocos creme de raio 10. Nada de estoque ou ficha
  técnica inventados.
- "Adicionar" **ainda sem carrinho**: o clique não muda o carrinho e só mostra
  o aviso "Carrinho chega já já."; fica indisponível em bairro não atendido.
- "Mais de <categoria>": até 4 outros produtos da mesma categoria, nos mesmos
  cards (sem "+"); a seção some sem itens.

## Checkout (`/checkout`)
- Cabeçalho compacto: logo à esquerda, "🔒 Checkout seguro" em verde à direita.
  Container de 1080px. Sem sessão: título "Para fechar o pedido, entre ou crie
  sua conta" e o cartão de autenticação; com sessão, o formulário aparece na
  mesma URL (nunca redireciona).
- Duas colunas (1.5fr / 1fr). Passos numerados com um círculo laranja:
  **1 Endereço** (faixa verde "Dentro da área de cobertura · entrega em ~X
  min", campos com rótulo 13px/700 em `--ink-soft`) e **2 Pagamento** (pílulas
  Pix / Cartão / Faturado; a ativa laranja sobre pêssego; explicação em bloco
  creme). Resumo fixo à direita: itens, régua tracejada, subtotal, entrega,
  total, faixa verde com a janela de chegada e o botão "Confirmar pedido".

## Acompanhamento (`/pedidos/:id/acompanhar`)
- Cabeçalho compacto com "Voltar para a loja →". `h1` "Pedido #4211" + badge
  verde "A caminho" com ponto pulsando; linha de contexto em cinza.
- Esquerda: bloco escuro com a bike verde e a janela "14:52 – 14:58 · faltam
  ~9 min"; cartão "Status do pedido" com linha do tempo (concluído = círculo
  verde com ✓ e linha verde; atual = anel verde com ponto pulsando; futuro =
  cinza-claro); cartão do entregador com botões de chat (contorno) e ligar
  (verde); cartão "Itens do pedido" com total tracejado.
- Direita (fixa): mapa ilustrativo (quarteirões brancos sobre `--map`, rota
  laranja pontilhada, loja escura, cliente laranja pulsando) com selos brancos.

## Área administrativa (`/admin`)
- Sidebar escura fixa de 236px: logo com o rótulo "OPERAÇÃO", itens com ícone
  Lucide (raio 12; o ativo é laranja com texto branco, contador em pílula) e o
  usuário no rodapé (avatar com iniciais em `--brand-light`, nome e e-mail; abre
  menu com "Ver loja", "Sair"). No mobile vira gaveta com barra branca em cima.
- Conteúdo sobre papel, padding 26/30: saudação "Bom dia, Paula 👋" em
  Bricolage 26 + data e status da operação; à direita a badge verde "14 entregadores online"
  e "Ver loja →" em contorno.
- KPIs: cartões brancos (raio 18) com rótulo cinza, quadradinho pastel com
  emoji, valor em Bricolage 28 e a variação (verde/cinza) abaixo.
- "Pedidos em andamento": grade de 5 colunas com cabeçalho em caixa alta
  pequena, entregador com 🚴/🚶, status em badge colorida e ETA (vermelho quando
  atrasado). Ao lado: "Tempo médio por hora" (barras laranja, acima da meta em
  laranja claro com o número em vermelho), que no desktop estica até a altura
  da tabela.
- "Estoque baixo": cartões com emoji, nome e barra de progresso
  amarela (< 20% vermelha).
- Páginas de módulo: `PageSectionHeader` (título Bricolage 26 + subtítulo +
  ações), filtros em chips, tabelas dentro de `TableCard`. Módulos sem dados
  usam `EmptyDashboardState` (emoji + título + explicação).
- Login do admin (`/admin/login`): cartão branco centrado sobre papel com o
  logo, badge escura "Operação", abas segmentadas "Entrar / Criar conta" e o
  link "← Voltar para a loja".
