## Context

A motivação está em `proposal.md`, e o comportamento nos deltas de `catalog/storefront`, `shared/design-system`, `orders/storefront-cart`, `orders/checkout-access` e `auth/storefront-access`. Estado atual relevante, conferido no código:

- `storefront.mock.ts` define `ZONES` (6 bairros com `store`, `storeSlug`, `city`, `state`), `UNSERVED_NEIGHBORHOODS` (`Pinheiros`, `Moema`, `Copacabana`), `ETA_BY_NEIGHBORHOOD`, `zoneOf`, `storeOf` e `groupNeighborhoodsByStore`. Nada disso existe no banco.
- `storefront-query.util.ts` lê e escreve `bairro` (`parseStorefrontParams`, `buildStorefrontQuery`, `storefrontBaseParams`, `buildStorefrontHref`). `query` percorre todos os links da vitrine, o detalhe, o checkout, o `voltar=` do acesso e o `myAccountRoute`.
- `useStorefront()` expõe `neighborhood`, `setNeighborhood`, `served`, `etaMinutes`, `store`, `storeSlug`, `city`, `state`, `stores` (bairros agrupados por loja), `neighborhoods`, `servedNeighborhoods` e `query`.
- `DeliveryPill` é o seletor de bairro com ETA ("Entrega em ~18 min · Bela Vista", "Ainda não atendemos"). `StorefrontFooter` lista bairros. `StorefrontHero` escreve "De bike e a pé por <bairro>".
- `storefront.component.tsx` tem o estado vazio "Ainda não chegamos aí. Já já."; `product-card` e `product-detail` bloqueiam a inclusão quando `served` é falso; `checkout.page.tsx` mostra "Dentro da área de cobertura · entrega em ~N min" e pré-preenche bairro/cidade/UF pelo bairro da vitrine.
- `GET /storefront/stores` (público, entregue na change `minha-conta`) devolve `id`, `name`, `slug`, `address` (texto livre), `latitude`, `longitude` e `deliveryRadiusMeters`, só de lojas ativas, ordenadas por nome. `useStorefrontStores()` já carrega essa lista e casa por slug.
- A change `minha-conta` (não arquivada) usa `useStorefront().storeSlug`, `city` e `state` para centrar o mapa e pré-preencher o formulário.

## Goals / Non-Goals

**Goals:**
- Trocar a unidade de navegação da vitrine de bairro (simulado) para loja (real), com o mínimo de conceitos novos.
- Preparar o terreno da cobertura por raio: depois desta change, a loja é um dado real com ponto e raio, e o cliente tem ponto — falta só a regra.
- Não deixar número inventado na interface.

**Non-Goals:**
- Catálogo, preço ou estoque por loja.
- Escolher a loja automaticamente pelo ponto do cliente (é a regra de cobertura, da próxima entrega).
- Cidade e UF estruturadas no cadastro de loja.
- Guardar a loja no pedido.

## Decisions

### 1. `?loja=<slug>` substitui `?bairro=`, e `bairro` é ignorado
O slug é estável, único e já é a chave que casa a loja da vitrine com a API. Um `bairro` remanescente na URL é ignorado em vez de redirecionado: links antigos (e o histórico do navegador) continuam abrindo a vitrine, só não escolhem mais nada.
- Alternativa: aceitar `bairro` e mapear para a loja pelo mock. Rejeitada porque manteria vivo justamente o mapeamento bairro→loja que esta change existe para eliminar.

### 2. Loja em vigor: URL → memória do navegador → primeira loja ativa
A URL manda, porque é ela que é compartilhada e recarregada. Sem `loja` na URL, vale a escolha lembrada (`localStorage`, uma chave com o slug); sem ela, a primeira loja ativa da ordem da API (por nome). Uma escolha lembrada de loja que não está mais ativa é descartada.
- `localStorage` pode falhar ou vir vazio (janela privada, dados limpos): toda leitura e escrita em `try/catch`, e a falha vale como "sem escolha". O slug não vai para a API.
- Alternativa: cookie. Rejeitada porque a escolha não precisa ir ao servidor.
- Alternativa: obrigar a escolher na primeira visita. Rejeitada com o usuário: barreira na entrada por uma decisão que ele pode trocar no cabeçalho.

### 3. Fim do ETA no cabeçalho
`ETA_BY_NEIGHBORHOOD` era um número inventado por bairro; por loja ele seria igualmente inventado. A pílula passa a mostrar a loja escolhida e a cidade/UF dela. O tempo volta quando existir cálculo real (distância, fila, trânsito), com dado do backend.
- O componente deixa de se chamar "pílula de entrega" e passa a ser o seletor de lojas, mantendo o formato de pílula do cabeçalho.
- Consequência: o cartão de entrega do detalhe do produto e o rodapé perdem as menções a tempo por bairro; o rodapé lista as lojas.

### 4. Sem conceito de "não atendido" nesta etapa
Hoje "não atendido" é uma propriedade do bairro escolhido, e ela some com o bairro. Enquanto a regra por raio não existir, a vitrine sempre mostra o catálogo e a inclusão no carrinho nunca é bloqueada. O que sai: o estado vazio "Ainda não chegamos aí. Já já.", o gate do "+" nos cards, o gate do "Adicionar" no detalhe, "Ainda não atendemos" na pílula e o aviso "Dentro da área de cobertura" do checkout.
- Isso é deliberadamente um passo atrás na aparência de cobertura para um passo à frente na verdade: bloquear por bairro era errado por construção. A próxima entrega bloqueia por raio, no checkout, com o ponto do cliente.

### 5. Cidade e UF vindas do endereço da loja, com regra explícita
`ZONES` trazia `city`/`state` por bairro, e "Minha conta" e o checkout usavam isso para pré-preencher. A loja real só tem `address` em texto livre, que no seed termina em `Cidade/UF` ("Avenida Paulista, 2073 – Conjunto Nacional, Bela Vista, São Paulo/SP"). Uma função pequena lê o trecho final `<Cidade>/<UF>` (UF de 2 letras) e devolve `null` quando o endereço não termina nesse formato; sem valor, os campos ficam vazios. O bairro deixa de ser pré-preenchido, porque a vitrine não sabe mais o bairro do cliente.
- Alternativa: cidade e UF estruturadas no cadastro de loja. É o certo a prazo, mas mexe em domínio, migration, API, admin e seed — fica registrado como trabalho seguinte.
- Registrado como risco: endereço de loja fora do formato deixa de pré-preencher. É degradação silenciosa e aceitável (o usuário digita), nunca um valor errado.

### 6. Uma etapa só, num subagente de frontend
Não há mudança de backend, domínio, banco ou seed: a API já existe. O trabalho é uma refatoração ampla de frontend (URL, hook, cabeçalho, rodapé, hero, vitrine, detalhe, checkout, "Minha conta"), melhor feita de uma vez para não deixar a árvore num estado meio bairro, meio loja.

### 7. Coordenação com a change `minha-conta`
`minha-conta` não está arquivada e descreve os padrões de "Minha conta" a partir do bairro da vitrine. Os deltas dela são atualizados junto (cenários com `?loja=`, padrões pela loja escolhida), para as duas changes descreverem o mesmo sistema. O código de "Minha conta" muda pouco: o mapa já usa `storeSlug` e a lista de lojas.

## Risks / Trade-offs

- [A vitrine deixa de sinalizar qualquer cobertura, e o cliente pode pedir para um endereço fora do raio] → É o estado de hoje na prática (o bairro acertava por acaso). A regra por raio é a próxima entrega, e o ponto do cliente já está gravado.
- [Perder o ETA enfraquece o apelo de rapidez do cabeçalho] → Decisão do usuário: melhor sem número do que com número inventado. O hero continua falando de minutos como promessa da marca, sem prometer um valor por endereço.
- [Endereço de loja em texto livre fora do formato `Cidade/UF`] → Pré-preenchimento vazio, nunca errado; cidade/UF estruturadas ficam como trabalho seguinte.
- [Links e favoritos com `?bairro=`] → Continuam funcionando, caindo na loja padrão ou lembrada.
- [Refatoração ampla pode quebrar a preservação de parâmetros em algum link] → A validação percorre os caminhos que carregam a query: card, trilha, busca, filtros, paginação, detalhe, checkout, `voltar=` do acesso e "Minha conta".

## Migration Plan

1. Sem passo de banco, API ou seed: só frontend.
2. A troca é atômica no build do frontend. Não há URL antiga a manter viva além de ignorar `bairro`.
3. Rollback: reverter o frontend. Nada persistido muda de formato; a única memória nova é a escolha de loja no navegador, inofensiva se ficar órfã.
4. Depois do archive, o `## Purpose` de `openspec/specs/catalog/storefront/spec.md` e o de `orders/checkout-access` podem precisar de um ajuste de uma frase (citam bairro), o que deltas não alteram.
