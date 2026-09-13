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
  categoria tem o seu (ver `product-art.component.tsx`).
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
- Ícones: Lucide, traço 2–2.5px, tamanho 16–18px. **Emoji** para a "imagem"
  do produto, quadradinhos de KPI e ilustrações de estado vazio — sem fotos,
  sem marcas.
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
  ("Entrega em ~18 min · Aldeota", abre menu de bairros), busca em pílula
  creme, "Entrar" em contorno (ou pílula com o primeiro nome + menu "Sair") e
  o botão laranja **Carrinho** com o contador em branco.
- Chips de categoria em pílulas brancas com emoji; a ativa fica laranja sobre
  pêssego. Vivem na URL (`categoria`), junto com `bairro`.
- Hero escuro (raio 24): badge translúcido, título em Bricolage com "em
  minutos." em `--brand-light`, CTA "Pedir agora", ponto verde pulsando com
  entregadores online e dois cartões brancos de "pedidos ao vivo".
- Seções "Mais pedidos nos escritórios", "Repor agora" e "Ofertas da semana"
  (cards de 220px, selo `−N%` laranja no lugar do ETA). Título em Bricolage
  24px e "Ver tudo →" laranja à direita. Com categoria selecionada, uma única
  seção com o nome da categoria.
- Card de produto: branco, raio 18, padding 12; área de imagem pastel
  (120px) com selo de ETA branco no canto; nome 700, unidade cinza, preço 800
  e o "+" redondo laranja em contorno, que vira o stepper `− n +` (pêssego)
  quando o item está no carrinho.
- Rodapé branco: wordmark + horário, "Áreas atendidas" em pílulas creme e o
  link discreto "Área administrativa".
- Bairro não atendido: cartão branco com "Ainda não chegamos aí. Já já." em
  display e os bairros atendidos em pílulas clicáveis, agrupados por hub.

## Carrinho (gaveta)
- Painel branco de 400px à direita, canto interno de 22px, `shadow-drawer`;
  título "Seu carrinho" em Bricolage; faixa verde "Saindo de bike · chega em
  ~X min"; itens com emoji pastel, nome, preço unitário, stepper pequeno e o
  total da linha; rodapé com subtotal, "Entrega de bike" (**Grátis** em verde
  acima de R$ 79, senão R$ 4,90), total e o botão "Finalizar pedido · R$ X".
- Persistido em `localStorage` (`jaja.cart`) via store externo com
  `useSyncExternalStore`: servidor e hidratação veem o carrinho vazio.

## Detalhe do produto (`/p/:slug`)
- Caminho "Início / Categoria / Nome" em cinza, o nome em negrito.
- Duas colunas (imagem 1.05fr / info 1fr). Imagem: bloco pastel de 380px
  (raio 24) com o emoji grande e o selo "Chega em ~X min"; três miniaturas de
  72px, a ativa com borda laranja 2px.
- Coluna de informação: badges (Mais pedido · Oferta · Em estoque no hub X /
  Últimas N / Acabou), `h1` em Bricolage 32, unidade em cinza, preço 34px em
  Bricolage, stepper grande (creme) + botão "Adicionar · R$ total" (que abre a
  gaveta), cartão de entrega (bike verde + caminhão laranja: ETA e a regra do
  frete grátis), "Sobre o produto" e a ficha em pares `rótulo · valor` sobre
  blocos creme de raio 10.
- "Quem pediu, também levou": até 4 da mesma categoria, nos mesmos cards.

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
  laranja pontilhada, hub escuro, cliente laranja pulsando) com selos brancos.

## Área administrativa (`/admin`)
- Sidebar escura fixa de 236px: logo com o rótulo "OPERAÇÃO", itens com ícone
  Lucide (raio 12; o ativo é laranja com texto branco, contador em pílula) e o
  usuário no rodapé (avatar com iniciais em `--brand-light`, nome, hub; abre
  menu com "Ver loja", "Sair"). No mobile vira gaveta com barra branca em cima.
- Conteúdo sobre papel, padding 26/30: saudação "Bom dia, Paula 👋" em
  Bricolage 26 + data e hub; à direita a badge verde "14 entregadores online"
  e "Ver loja →" em contorno.
- KPIs: cartões brancos (raio 18) com rótulo cinza, quadradinho pastel com
  emoji, valor em Bricolage 28 e a variação (verde/cinza) abaixo.
- "Pedidos em andamento": grade de 5 colunas com cabeçalho em caixa alta
  pequena, entregador com 🚴/🚶, status em badge colorida e ETA (vermelho quando
  atrasado). Ao lado: "Tempo médio por hora" (barras laranja, acima da meta em
  laranja claro com o número em vermelho) e "Área de cobertura" (mapa com o
  raio tracejado e a lista bairro → ETA, verde até 25 min, amarelo acima).
- "Estoque baixo no hub": cartões com emoji, nome e barra de progresso
  amarela (< 20% vermelha).
- Páginas de módulo: `PageSectionHeader` (título Bricolage 26 + subtítulo +
  ações), filtros em chips, tabelas dentro de `TableCard`. Módulos sem dados
  usam `EmptyDashboardState` (emoji + título + explicação).
- Login do admin (`/admin/login`): cartão branco centrado sobre papel com o
  logo, badge escura "Operação", abas segmentadas "Entrar / Criar conta" e o
  link "← Voltar para a loja".
