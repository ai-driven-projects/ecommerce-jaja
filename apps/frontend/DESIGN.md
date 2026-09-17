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
- Estados: verde `--success #0E9F5D` / `--success-soft #E7F6EE` (entrega,
  em estoque, grátis) · amarelo `--warning #B78A00` / `--warning-soft #FFF7DD`
  (separando, estoque baixo) · vermelho `--danger #C93A31` / `--danger-soft
  #FDEBEA` (atrasado, erro, esgotado).
- Escuro: `--dark #1E1812` para hero e sidebar do admin; texto
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
  grande do produto e valor dos KPIs.
- Números (preço, KPI) em `font-extrabold tabular-nums`; preço sempre no
  formato `R$ 1.290,90` via `formatPrice`. Em oferta, preço atual em laranja e o
  anterior riscado em `--placeholder`.
- Sem caixa alta decorativa. A única exceção são cabeçalhos de tabela e
  rótulos de grupo (`text-xs font-extrabold uppercase tracking-[0.04em]`).

## Regras
- Cor de ação é só o laranja: botão primário, "+" de adicionar, chip ativo,
  link "Ver tudo →", item ativo da sidebar. Verde é informação positiva
  (entrega, grátis, em estoque), nunca ação.
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
  + `shadow-card`. A única animação contínua é o pulso suave
  (`animate-pulse-soft`): o ponto verde em "entregadores online" / "a caminho" /
  "Ao vivo" e, no painel do pedido do admin, "Em andamento…" e os consumidores
  aguardando; com `prefers-reduced-motion`, os de pedido não pulsam (`motion-safe:`).
- Foco de teclado: `outline: 2px solid var(--brand); offset 2px` (global).
  Inputs trocam a borda para laranja no foco e não mostram outline.
- Carregando: a estrutura da página com blocos creme estáticos
  (`bg-surface`, mesmos raios). Sem shimmer, sem spinner.
- Texto dependente do relógio (saudação, horários) só
  entra depois da hidratação via `useClientMinute`; o servidor renderiza a
  estrutura com "…".

## Vitrine (`/`)
- Cabeçalho fixo branco com borda inferior: logo (bloco laranja com a bike +
  "já já" em Bricolage 800), **seletor de lojas** numa pílula creme com o ícone
  de loja laranja ("Loja Paulista · São Paulo/SP", abre o menu "Comprar na
  loja" com as lojas ativas e a atual marcada), **busca** em pílula creme,
  "Entrar" em contorno (ou pílula com o primeiro nome e o menu da conta) e o
  botão laranja **Carrinho** com o contador em branco. Sem tempo estimado de
  entrega e sem texto de cobertura: não há cálculo real de nenhum dos dois.
- Seletor de lojas: as lojas ativas vêm de `GET /storefront/stores`, e a loja
  em vigor sai de `loja` na URL, da escolha lembrada no navegador
  (`jaja:vitrine:loja`, descartada quando a loja não está mais ativa) ou da
  primeira loja ativa. Escolher grava `loja=<slug>` na URL sem entrada no
  histórico e lembra a escolha. Enquanto as lojas carregam (e com uma só loja
  ativa) a pílula fica estática, sem menu — "Escolha a loja" em `--placeholder`
  no carregamento, o mesmo texto do esqueleto do cabeçalho. A cidade/UF sai do
  fim do endereço de referência da loja (`…, São Paulo/SP`) e some quando o
  endereço não tem esse formato.
- Menu da conta, nesta ordem: nome completo e, abaixo, o email do usuário
  ("Administrador" para administradores); "Minha conta" (ícone `UserRound`,
  leva a `/minha-conta` com a query atual da vitrine); "Área administrativa"
  (`ShieldCheck`, só administradores); "Sair" em vermelho ("Até já já.",
  continua na mesma página).
- Busca do cabeçalho: "Buscar papel A4, toner, café…"; a lupa (ou Enter)
  envia e o "×" limpa o texto. Leva a `/?q=<termo>` mantendo só a loja
  (também a partir do detalhe); vazio remove a busca. O campo mostra o `q` da
  URL, inclusive depois de recarregar.
- Chips de categoria em pílulas brancas roláveis: "Tudo" + as raízes do
  catálogo, com o emoji da raiz; a ativa fica laranja sobre pêssego. Categoria
  com filhas abre uma segunda linha de chips menores ("Tudo em <Categoria>" +
  subcategorias com a contagem em cinza); numa neta, as linhas da raiz e do pai
  continuam visíveis. Estado na URL (`categoria` por slug), junto com `loja`.
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
  nesta prioridade: `−N%` laranja e "Destaque"; nome 700 em até
  3 linhas (o nome inteiro no `title`), unidade cinza e preço 800. O "+"
  redondo laranja em contorno, que vira o stepper `− n +` (pêssego) quando o
  item está no carrinho, aparece em todas as grades da loja (página inicial,
  listagem e "Mais de <categoria>"), sempre disponível; o "+" do stepper fica
  desabilitado em 99 unidades.
- Rodapé branco: wordmark + horário, "Nossas lojas" em pílulas creme e o
  link discreto "Área administrativa".
- A loja escolhida não muda o catálogo, os preços nem a disponibilidade, e não
  existe estado de área não atendida: a vitrine sempre mostra o catálogo. A
  verificação de cobertura por raio chega numa entrega seguinte.

## Carrinho (gaveta)
- Painel branco de 400px à direita (a largura da tela no mobile), canto
  interno de 22px, `shadow-drawer`; título "Seu carrinho" em Bricolage.
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
  quadrada (raio 24, borda `--line`) com a foto grande sobre branco; com mais
  de uma imagem, setas redondas brancas nas
  laterais, contador "n/total" no canto e miniaturas de 72px de todas as
  imagens, roláveis na horizontal, a ativa com borda laranja 2px (setas do
  teclado navegam entre elas). Com uma imagem, sem setas, contador nem
  miniaturas; sem imagens, o emoji da categoria sobre o tom pastel.
- Coluna de informação: badges "Em destaque" e `−N%`, a marca como link
  laranja para a listagem da marca, `h1` em Bricolage 32, unidade e
  "Cód. <sku>" em cinza, preço 34px em Bricolage com o "De:" riscado, stepper
  grande (creme) + botão "Adicionar · R$ total", cartão de entrega (bike verde
  "Entrega de bike · saindo da <loja escolhida>" + caminhão laranja com a regra
  do frete grátis, sem tempo estimado), "Sobre o produto"
  (quebras de linha preservadas; acima de 600 caracteres, recolhido com "Ler
  mais"/"Ler menos") e a ficha (Marca, Categoria, Código, Unidade) em pares
  `rótulo · valor` sobre blocos creme de raio 10. Nada de estoque ou ficha
  técnica inventados.
- "Adicionar" inclui a quantidade escolhida (stepper de 1 a 99) no carrinho:
  "Adicionando…" desabilitado enquanto espera; no sucesso, toast "Adicionado
  ao carrinho" com "<n> un · R$ X" e a ação "Ver carrinho" (abre a gaveta), e a
  quantidade volta a 1; no erro (limite de 99, produto indisponível), toast de
  erro. Abaixo do botão, "Você já tem N no carrinho." quando o produto já está
  nele. Nunca indisponível por causa da loja escolhida.
- "Mais de <categoria>": até 4 outros produtos da mesma categoria, nos mesmos
  cards (com o "+"); a seção some sem itens.

## Checkout (`/checkout`)
- Cabeçalho compacto: logo à esquerda, "🔒 Checkout seguro" em verde à direita.
  Container de 1080px. Sem sessão: título "Para fechar o pedido, entre ou crie
  sua conta" e o cartão de autenticação; com sessão, o formulário aparece na
  mesma URL (nunca redireciona). "← Voltar para a loja" acima do título
  preserva a query da vitrine (`loja` e `categoria`).
- Duas colunas (1.5fr / 1fr). Passos numerados com um círculo laranja:
  **1 Endereço** (sem nenhuma faixa de cobertura: não há verificação de área
  nesta versão; campos com rótulo 13px/700 em `--ink-soft`; sem cadastro de
  cliente, cidade e UF nascem com as da loja escolhida, quando conhecidas, e o
  bairro fica vazio; abaixo dos dados de entrega,
  "Quem recebe", iniciado com o nome do usuário, até 100 caracteres, e
  "Instruções para o entregador", até 200, que não vão para o cadastro) e **2
  Pagamento** simulado, sem seletor nem campos: badge creme "Simulado" ao lado
  do título e a explicação em bloco creme ("Não pedimos nenhum dado de
  pagamento…"). Resumo fixo à direita, com o carrinho da conta recarregado ao abrir:
  itens com a foto (`ProductArt`), o nome em até 2 linhas, "× quantidade" e o
  total da linha (indisponível: atenuado, badge "Indisponível" e "Remover");
  blocos creme estáticos na primeira carga (inclusive a mescla logo depois de
  entrar); régua tracejada, subtotal, entrega e total da API (atenuados
  enquanto sincroniza) e o botão
  "Confirmar pedido", desabilitado enquanto o carrinho carrega ou sincroniza,
  vazio ou com itens indisponíveis ("Remova os itens indisponíveis para
  confirmar o pedido."). "Confirmar pedido" cria o pedido na API ("Confirmando…"
  desabilitado enquanto espera): no sucesso, o servidor já esvaziou o carrinho,
  toast "Pedido #<número> recebido" com "Pagamento simulado em andamento." e ida
  ao acompanhamento; no erro, toast com a mensagem, resumo (e dados de entrega,
  quando a recusa é do cadastro) recarregados e a página continua no checkout.
  O número do pedido são os 8 primeiros caracteres do id em maiúsculas.

## Minha conta (`/minha-conta`)
- Aberta pelo menu da conta; usa o **cabeçalho completo** da loja (seletor de
  lojas, busca, conta e carrinho) e leva a query da vitrine. Container de 1080px,
  `h1` "Minha conta" em Bricolage 30. Nunca redireciona.
- Sem sessão: título "Entre para ver sua conta" e o cartão de autenticação
  (abas "Entrar" / "Criar conta") na mesma URL, como no checkout; "Sair" nesta
  página volta a esse cartão.
- Carregando (cadastro e lojas da vitrine): os dois cartões com blocos creme
  estáticos. Sem cadastro de cliente: o apoio "Preencha uma vez e seus pedidos
  saem mais rápido." e o formulário com a cidade e a UF da loja escolhida na
  vitrine, quando conhecidas, e o bairro vazio.
- Cartões brancos (raio 24, os do checkout), título em Bricolage 18:
  - **Dados pessoais**: nome e email somente leitura (blocos creme), apoio
    "Nome e email são da sua conta de acesso.", CPF e telefone com máscara,
    lado a lado a partir de `sm`;
  - **Endereço de entrega**: o mapa do ponto acima dos campos do checkout
    (separados por régua `--line`).
- Mapa do ponto (`CustomerAddressMap`):
  - acima, "Localizar endereço no mapa" em contorno (habilitado com logradouro
    e cidade; move marcador e câmera, grava o ponto e mostra "Endereço
    encontrado: …", sem mudar os campos);
  - Google Maps de 340px (raio 16, borda `--line`): abre no ponto do cliente
    (zoom de rua), senão enquadrando a loja da vitrine com todo o círculo de
    atendimento dela, senão na Avenida Paulista, 1578 — nunca enquadrando todas
    as lojas de uma vez (as do seed estão a ~360 km uma da outra);
  - **todas as lojas ativas** aparecem no mapa, cada uma com um marcador fixo
    (título "`<nome>` · atende até `<raio>`") e um círculo read-only do raio de
    atendimento: a loja da vitrine em laranja (círculo escuro de 36px com o
    ícone `Store`, borda branca, `shadow-float`, área laranja 12% com borda
    85%), as outras discretas (círculo de 28px em `--muted-ink`, área
    `--muted-ink` 9% com borda 70%). Clicar no marcador ou dentro do círculo de
    uma loja marca o ponto do cliente ali, como um clique no mapa. Marcador do
    cliente: pino laranja, arrastável, só quando há ponto, sempre por cima;
  - abaixo do mapa (também no simulado, que não desenha nada), o bloco creme
    "Área de atendimento das lojas": uma linha por loja com o ícone `Store`, o
    nome, "atende até `<raio>`" (`formatRadius`), a badge de contorno "Loja da
    vitrine" na selecionada, o botão fantasma "Ver no mapa" (ícone `MapPin`,
    enquadra aquela loja com todo o círculo) e, na linha de baixo, o endereço de
    referência da loja; no canto do título, "Ver todas as lojas" (fantasma, com
    duas ou mais lojas, `fitBounds` das lojas e do ponto). As duas ações só
    aparecem com o mapa real e **não** mexem no ponto nem pedem sugestão.
    Apoio: "O raio mostra até onde cada loja entrega hoje. É só informação: você
    pode marcar e salvar o ponto onde quiser." — **nada é bloqueado nem
    sugerido** pela posição do ponto em relação ao raio;
  - clique no mapa ou fim do arraste grava o ponto e pede a sugestão (nunca
    durante o arraste; resposta atrasada é descartada). Cartão creme
    (`role="status"`): "Buscando endereço…"; "Endereço sugerido: …" com "Usar
    este endereço" (primário) e "Dispensar" (contorno), "Confira o número
    depois de usar o endereço." sem número e o aviso amarelo de busca simulada
    com `source: "mock"`; sem endereço, "Não encontramos um endereço para este
    ponto. Preencha os campos abaixo."; indisponível, toast;
  - mudar CEP, logradouro, número, bairro, cidade ou UF depois de uma ação no
    mapa troca a linha do botão pelo aviso amarelo "O endereço mudou depois de
    o ponto ser marcado. Confira o ponto no mapa." com o mesmo botão
    (complemento não conta);
  - abaixo, o apoio "Clique no mapa ou arraste o marcador até a porta de
    entrada. Sugerimos o endereço do ponto, e você decide se usa." e "Remover
    ponto" (fantasma, vermelho) quando há ponto;
  - sem chave pública ou com a chave recusada: a ilustração do cadastro de loja
    com o selo "Mapa simulado", o ponto marcado num selo branco e o botão "Usar
    ponto de exemplo" (ponto da loja da vitrine ou da Paulista), com a lista das
    lojas e os raios logo abaixo; com a chave recusada, também o aviso amarelo
    de falha do Google Maps;
  - `CUSTOMER_LOCATION_INVALID` aparece como erro geral acima do mapa.
- Rodapé à direita (em coluna no celular): "Salvar dados" (primário grande,
  desabilitado sem alterações, "Salvando…" enquanto envia) e "Descartar
  alterações" em contorno, só com alterações. Salvar: toast "Dados salvos" e
  o formulário volta a ficar sem alterações; os dados são os mesmos do passo
  de entrega do checkout.
- Checkout e edição administrativa de clientes continuam sem mapa e devolvem o
  ponto recebido do cadastro.

## Acompanhamento (`/pedidos/:id/acompanhar`)
- O pedido real do cliente autenticado, lido da API. Cabeçalho compacto com
  "Voltar para a loja →"; título da aba "Pedido #<número> — já já".
- Estados: até hidratar e na primeira carga, blocos creme estáticos (sem dados
  de pedido); sem sessão, cartão branco centrado com 🔒 "Entre para acompanhar
  seu pedido." e o botão laranja "Entrar" (volta a esta rota por `voltar`);
  pedido inexistente ou de outra conta, 🔎 "Pedido não encontrado." com "Voltar
  para a loja" em contorno.
- `h1` "Pedido #3F1C9A52" (8 primeiros caracteres do id em maiúsculas) + badge
  com o nome do status atual ("Pedido recebido", "Pagamento aprovado" e "A
  caminho" em verde; "Separando na loja" em amarelo; "Entregue" neutro) +
  indicador ao vivo: bolinha verde pulsando com "Ao vivo" enquanto o stream está
  aberto, "Reconectando…" em cinza enquanto abre ou reabre, e nada sem stream
  (pedido entregue ou recusado); com `prefers-reduced-motion`, a bolinha não
  pulsa. "Feito hoje às HH:MM" (ou "Feito em DD/MM/AAAA às HH:MM") em cinza, só
  depois da hidratação; endereço copiado no pedido (ícone de pino) e "Quem
  recebe".
- Esquerda: cartão "Status do pedido" com os passos "Pedido recebido",
  "Pagamento aprovado", "Separando na loja", "A caminho" e "Entregue", derivados
  do status:
  - concluídos até o status atual: círculo verde com ✓, linha verde e a hora
    (`HH:MM:SS`, com segundos para mostrar a demora de cada serviço) do passo;
  - o seguinte, enquanto não foi entregue: círculo laranja claro com miolo
    laranja e "Em andamento…" em laranja;
  - os demais em cinza-claro com "Aguardando".
  A lista anuncia as mudanças a leitores de tela (`aria-live="polite"`). O passo
  que se conclui com a página aberta recebe um destaque breve (fundo verde claro
  que some, sem animação com `prefers-reduced-motion`). Entregue: todos
  concluídos e, abaixo, o bloco verde claro "Pedido entregue às HH:MM.
  Obrigado por comprar no já já!".
- Ao vivo: enquanto o pedido não foi entregue, a página abre o stream de avisos
  da API (token no cabeçalho, nunca na URL) e relê o pedido a cada aviso e a
  cada reconexão, então badge e passos avançam sem recarregar. O stream fecha
  na entrega.
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
- Ao vivo: o layout abre **uma** conexão com o stream administrativo de pedidos
  por aba (token no cabeçalho, nunca na URL), compartilhada por menu, lista,
  dashboard e painel; cada tela relê a API a cada aviso e a cada reconexão.
  `LiveIndicator` (o mesmo do acompanhamento): bolinha verde pulsando com "Ao
  vivo", cinza com "Reconectando…" enquanto abre ou reabre e vermelha com
  "Desconectado" quando a API recusa o stream; sem pulso com
  `prefers-reduced-motion`. O contador de "Pedidos" no menu são os pedidos em
  andamento reais, oculto enquanto carrega e quando é 0.
- Destaque ao vivo: o que chega com a tela aberta (linha nova, célula de status
  que mudou, evento novo) recebe um fundo `--brand-soft` que some
  (`animate-live-new`), só com `motion-safe:`.
- KPIs do dia (resumo de pedidos da API, relido ao vivo): cartões brancos (raio
  18) com rótulo cinza, quadradinho pastel com emoji e valor em Bricolage 28 —
  "Pedidos hoje" (com "N entregues" em verde abaixo), "Em andamento", "Ticket
  médio hoje" e "Tempo até a entrega" ("X min", "Y s" abaixo de 1 min); "—" sem
  dados de hoje e "…" enquanto carrega.
- "Pedidos em andamento" (largura toda): título com o `LiveIndicator` e "Ver
  todos →"; a tabela dos últimos pedidos em andamento (Pedido, Cliente, Destino,
  Status e Atualizado), com a linha levando ao painel; vazio: "Nenhum pedido em
  andamento agora." num bloco creme. Sem "Tempo médio por hora".
- Entregadores online (badge verde) e "Estoque baixo" (cartões com emoji, nome e
  barra de progresso amarela, < 20% vermelha) continuam com dados de exemplo.
- Lista de pedidos (`/admin/orders`): `PageSectionHeader` "Pedidos" com "N
  pedido(s) · M em andamento" e o `LiveIndicator` à direita; busca em pílula
  "Buscar por número ou cliente"; chips (Todos, Em andamento e os cinco status),
  o ativo laranja sobre pêssego; página, status e busca na URL. Tabela em
  `TableCard` (rola na horizontal dentro do cartão): Pedido (`#NÚMERO` em negrito,
  link), Cliente, Destino ("bairro · cidade · N itens"), Status (badge do
  status), Atualizado (`HH:MM:SS`) e Total. A linha inteira é clicável e leva ao
  painel mantendo a query. Vazio: 📦 "Nenhum pedido ainda." ("Os pedidos feitos
  na loja aparecem aqui na hora, sem recarregar."); com filtros: 🔎 "Nenhum
  pedido encontrado." com "Limpar filtros"; carregando: linhas creme.
- Painel do pedido (`/admin/orders/:id`, aba "Pedido #NÚMERO — Operação"):
  "← Pedidos" em laranja; "Pedido #NÚMERO" em Bricolage 26 com a badge do status
  e o `LiveIndicator`; "Feito às HH:MM:SS · há X" (relógio de 1 s, só depois da
  hidratação) e, entregue, "Entregue em Y" em verde. Duas colunas a partir de
  `xl` (1fr / 1.45fr), uma abaixo disso, com os cartões brancos (raio 18):
  - "Progresso": os passos do acompanhamento, concluídos com `HH:MM:SS` e a
    duração desde o anterior ("+3,2 s"), o atual "Em andamento…" pulsando em
    laranja e os demais "Aguardando";
  - "Cliente e entrega": pares rótulo/valor (cliente, e-mail, telefone
    formatado, endereço copiado, quem recebe e instruções);
  - "Itens": miniatura, nome, "× quantidade" e total da linha; subtotal, entrega
    e total;
  - "Eventos": "correlação `abcd1234` · N eventos" e a linha do tempo vertical
    (régua de 2px com um ponto verde por evento publicado, âmbar pendente). Cada
    evento é um cartão com borda `--line`: o `type` em mono, a hora
    `HH:MM:SS.mmm`, "mensagem `abcd1234`", "causado por `abcd1234`" (link para o
    cartão anterior), "Publicado às HH:MM:SS.mmm" em verde ou "Pendente" em âmbar
    (tentativas e último erro em vermelho), os consumidores (nome em mono +
    "Processado às HH:MM:SS" em verde; "Aguardando · espera de 3 s · em 2 s" e
    depois "processando…" em âmbar pulsando; "Aguardando publicação" em cinza; a
    badge "não registrado nesta instância") e o `<details>` "Payload e metadata"
    com o JSON em mono sobre creme. Rodapé discreto: "Atualizado pelos eventos
    que chegam do RabbitMQ. Falhas e descartes: painel do RabbitMQ ou `jaja
    broker:queues`." Pedido inexistente: 🔎 "Pedido não encontrado." com "Voltar
    para os pedidos".
- Páginas de módulo: `PageSectionHeader` (título Bricolage 26 + subtítulo +
  ações), filtros em chips, tabelas dentro de `TableCard`. Módulos sem dados
  usam `EmptyDashboardState` (emoji + título + explicação).
- Login do admin (`/admin/login`): cartão branco centrado sobre papel com o
  logo, badge escura "Operação", abas segmentadas "Entrar / Criar conta" e o
  link "← Voltar para a loja".
