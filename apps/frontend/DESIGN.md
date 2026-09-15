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
  item está no carrinho, aparece nas grades da loja (página inicial, listagem e
  "Mais de <categoria>") só quando o bairro é atendido; o "+" do stepper fica
  desabilitado em 99 unidades. Fora da área atendida, os cards não têm "+".
- Rodapé branco: wordmark + horário, "Áreas atendidas" em pílulas creme e o
  link discreto "Área administrativa".
- Bairro não atendido: cartão branco com "Ainda não chegamos aí. Já já." em
  display e os bairros atendidos em pílulas clicáveis, agrupados por loja, em
  qualquer modo (página inicial ou listagem).

## Carrinho (gaveta)
- Painel branco de 400px à direita (a largura da tela no mobile), canto
  interno de 22px, `shadow-drawer`; título "Seu carrinho" em Bricolage; faixa
  verde "Saindo de bike · chega em ~X min".
- Linhas: foto do produto (`ProductArt` `sm`, emoji pastel de reserva), o nome
  em até 2 linhas como link para o produto (preserva a query da vitrine e
  fecha a gaveta), unidade e preço unitário em cinza, stepper pequeno (0
  remove; "+" desabilitado em 99), o total da linha e a lixeira (`Trash2`,
  "Remover <nome> do carrinho").
- Linha indisponível: conteúdo atenuado, badge vermelha "Indisponível" e o
  botão "Remover" em contorno, sem stepper nem total.
- Primeira carga (inclusive a mescla ao entrar): blocos creme estáticos no
  lugar das linhas. Vazio: 🛒 "Seu carrinho está vazio."
- Rodapé com subtotal, "Entrega de bike" (**Grátis** em verde a partir de
  R$ 79, senão R$ 4,90, com "Faltam R$ X para a entrega grátis."), total e o
  botão "Finalizar pedido · R$ X". Os valores vêm sempre da API: enquanto uma
  mudança não foi confirmada, ficam atenuados com `aria-busy`. Com itens
  indisponíveis, aviso vermelho "Remova os itens indisponíveis para
  continuar.". O botão fica desabilitado sem itens, com itens indisponíveis ou
  enquanto sincroniza.
- Contador do cabeçalho e quantidades mudam na hora (0 até hidratar).
- Persistência: sem sessão, o carrinho do visitante fica em `localStorage`
  (`jaja.guest-cart`, `[{ productId, quantity }]`) via store externo com
  `useSyncExternalStore` (servidor e hidratação veem o carrinho vazio; o
  evento `storage` sincroniza as abas), com linhas e totais da prévia da API.
  Com sessão, o carrinho é o da conta, no servidor; ao entrar ou criar conta
  os itens do visitante são mesclados nele e apagados do navegador. Sair volta
  ao carrinho do visitante.

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
- "Adicionar" inclui a quantidade escolhida (stepper de 1 a 99) no carrinho:
  "Adicionando…" desabilitado enquanto espera; no sucesso, toast "Adicionado
  ao carrinho" com "<n> un · R$ X" e a ação "Ver carrinho" (abre a gaveta), e a
  quantidade volta a 1; no erro (limite de 99, produto indisponível), toast de
  erro. Abaixo do botão, "Você já tem N no carrinho." quando o produto já está
  nele. Indisponível em bairro não atendido.
- "Mais de <categoria>": até 4 outros produtos da mesma categoria, nos mesmos
  cards (com o "+" quando o bairro é atendido); a seção some sem itens.

## Checkout (`/checkout`)
- Cabeçalho compacto: logo à esquerda, "🔒 Checkout seguro" em verde à direita.
  Container de 1080px. Sem sessão: título "Para fechar o pedido, entre ou crie
  sua conta" e o cartão de autenticação; com sessão, o formulário aparece na
  mesma URL (nunca redireciona).
- Duas colunas (1.5fr / 1fr). Passos numerados com um círculo laranja:
  **1 Endereço** (faixa verde "Dentro da área de cobertura · entrega em ~X
  min", campos com rótulo 13px/700 em `--ink-soft`; abaixo dos dados de entrega,
  "Quem recebe", iniciado com o nome do usuário, até 100 caracteres, e
  "Instruções para o entregador", até 200, que não vão para o cadastro) e **2
  Pagamento** simulado, sem seletor nem campos: badge creme "Simulado" ao lado
  do título e a explicação em bloco creme ("Não pedimos nenhum dado de
  pagamento…"). Resumo fixo à direita, com o carrinho da conta recarregado ao abrir:
  itens com a foto (`ProductArt`), o nome em até 2 linhas, "× quantidade" e o
  total da linha (indisponível: atenuado, badge "Indisponível" e "Remover");
  blocos creme estáticos na primeira carga (inclusive a mescla logo depois de
  entrar); régua tracejada, subtotal, entrega e total da API (atenuados
  enquanto sincroniza), faixa verde com a janela de chegada e o botão
  "Confirmar pedido", desabilitado enquanto o carrinho carrega ou sincroniza,
  vazio ou com itens indisponíveis ("Remova os itens indisponíveis para
  confirmar o pedido."). "Confirmar pedido" cria o pedido na API ("Confirmando…"
  desabilitado enquanto espera): no sucesso, o servidor já esvaziou o carrinho,
  toast "Pedido #<número> recebido" com "Pagamento simulado em andamento." e ida
  ao acompanhamento; no erro, toast com a mensagem, resumo (e dados de entrega,
  quando a recusa é do cadastro) recarregados e a página continua no checkout.
  O número do pedido são os 8 primeiros caracteres do id em maiúsculas.

## Acompanhamento (`/pedidos/:id/acompanhar`)
- O pedido real do cliente autenticado, lido da API. Cabeçalho compacto com
  "Voltar para a loja →"; título da aba "Pedido #<número> — já já".
- Estados: até hidratar e na primeira carga, blocos creme estáticos (sem dados
  de pedido); sem sessão, cartão branco centrado com 🔒 "Entre para acompanhar
  seu pedido." e o botão laranja "Entrar" (volta a esta rota por `voltar`);
  pedido inexistente ou de outra conta, 🔎 "Pedido não encontrado." com "Voltar
  para a loja" em contorno.
- `h1` "Pedido #3F1C9A52" (8 primeiros caracteres do id em maiúsculas) + badge
  verde "Pedido recebido"; "Feito hoje às HH:MM" (ou "Feito em DD/MM/AAAA às
  HH:MM") em cinza, só depois da hidratação; endereço copiado no pedido
  (ícone de pino) e "Quem recebe".
- Esquerda: cartão "Status do pedido" com os passos "Pedido recebido",
  "Pagamento aprovado", "Separando na loja", "A caminho" e "Entregue". Só o
  primeiro está concluído (círculo verde com ✓, linha verde e a hora do
  pedido); os demais em cinza-claro com "Aguardando".
- Direita (fixa no desktop): cartão "Itens do pedido" com a foto (`ProductArt`
  `xs`; sem foto, a reserva padrão 🛒), nome em até 2 linhas, "× quantidade" e
  total da linha; régua tracejada, subtotal, entrega (**Grátis** em verde) e o
  total com "Pagamento simulado". Abaixo, "Instruções para o entregador" só
  quando existem.
- Sem mapa, entregador, previsão de chegada nem loja: voltam com o fluxo de
  entrega.

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
