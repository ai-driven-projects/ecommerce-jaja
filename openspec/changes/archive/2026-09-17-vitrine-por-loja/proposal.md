## Why

O cabeçalho da loja pede um **bairro**, e é o bairro que decide a loja, o tempo de entrega e a cobertura. Isso está errado na origem: a área de atuação de uma loja é um **raio** a partir do ponto dela, e bairro não mapeia raio — um bairro pode ter um pedaço dentro e a maior parte fora da entrega. Além disso, os 9 bairros do seletor são simulados (`ZONES` no frontend), enquanto as lojas são reais, estão no banco e já têm ponto e raio (`GET /storefront/stores`).

O usuário deve escolher a **loja**, que é o que existe de fato. A verificação de "este endereço é atendido?" vem depois, pelo raio da loja contra o ponto do cliente, que "Minha conta" já grava.

## What Changes

- **Seletor do cabeçalho passa a ser de lojas**, com as lojas ativas vindas de `GET /storefront/stores`: a loja escolhida em destaque e as demais disponíveis para troca. Sai o seletor de bairros.
- **URL:** `?loja=<slug>` substitui `?bairro=<nome>`, preservado em toda a navegação da vitrine (cards, trilha, busca, filtros, detalhe, checkout e `voltar` do acesso). Um `bairro` na URL é ignorado, e um slug desconhecido cai na loja padrão.
- **Loja padrão e memória da escolha:** sem `loja` na URL vale a primeira loja ativa (ordem da API, por nome); a escolha do usuário é lembrada no navegador e passa a valer nas visitas seguintes.
- **BREAKING (produto):** sai o **ETA** do cabeçalho ("Entrega em ~18 min"). A pílula passa a mostrar a loja escolhida e a cidade/UF dela. Não existe cálculo real de tempo, e o número por bairro era inventado; o tempo volta quando for calculado de verdade.
- **BREAKING (produto):** sai o estado **"Ainda não chegamos aí. Já já."** e todo o conceito de bairro não atendido: com loja escolhida, a vitrine sempre mostra o catálogo. Em consequência, o "+" dos cards e o "Adicionar" do detalhe deixam de ser bloqueados por cobertura, e o aviso de cobertura do checkout sai.
- **Dados simulados que saem** de `modules/catalog/data/storefront.mock.ts`: `ZONES`, `ETA_BY_NEIGHBORHOOD`, `UNSERVED_NEIGHBORHOODS`, `zoneOf`, `storeOf` e `groupNeighborhoodsByStore`. O rodapé deixa de listar bairros e passa a listar as lojas.
- **Textos que mudam:** o hero deixa de dizer "De bike e a pé por <bairro>" e passa a citar a loja; o rótulo do seletor deixa de falar em bairro.
- **Cidade e UF dos formulários:** "Minha conta" e o checkout pré-preenchiam cidade/UF pelo bairro. Passam a usar a cidade/UF da loja escolhida, lidas do fim do endereço de referência dela (`…, São Paulo/SP`); quando o endereço não terminar nesse formato, os campos ficam vazios. O bairro deixa de ser pré-preenchido.
- **Fora do escopo:**
  - validar se o endereço do cliente está dentro do raio da loja, bloquear pedido e sugerir a loja que atende (próximo prompt, agora com base no ponto e no raio);
  - catálogo, preço ou estoque por loja: o catálogo continua único, e escolher a loja não muda os produtos;
  - guardar a loja escolhida no pedido;
  - tempo de entrega calculado (por distância, trânsito ou fila);
  - cidade e UF estruturadas no cadastro de loja (hoje o endereço da loja é texto livre);
  - alterações em `packages/shared`.

## Capabilities

### Modified Capabilities

- `catalog/storefront`:
  - "Bairro e categoria na URL" é substituída por "Loja e categoria na URL" (`?loja=`, loja padrão, escolha lembrada);
  - "Bairro não atendido" é removida: não existe mais estado de bairro fora da área;
  - "Vitrine na rota raiz" e "Navegação para o detalhe do produto" passam a citar a loja, e não bairro e ETA.
- `shared/design-system`: "Cabeçalho da loja" passa a descrever o seletor de lojas sem ETA.
- `orders/storefront-cart`: "Adicionar pelos cards da loja" e "Adicionar no detalhe do produto" deixam de bloquear por bairro não atendido.
- `orders/checkout-access`: "Estado autenticado do checkout" preserva `loja` no "← Voltar para a loja", e "Dados de entrega do cliente no checkout" troca o pré-preenchimento pelo da loja escolhida e perde o aviso de cobertura por bairro.
- `auth/storefront-access`: "Retorno à página de origem" passa a exemplificar o retorno com `loja` na query.

## Impact

- `apps/frontend`:
  - `modules/catalog/data/`: `storefront.mock.ts` (perde zonas, ETA e bairros), `storefront.types.ts`, `storefront-query.util.ts` (`loja` em vez de `bairro`) e `use-storefront.hook.ts` (loja escolhida, lista de lojas, `setStore`, memória da escolha);
  - `modules/catalog/components/`: `storefront-shell.component.tsx`, `storefront-hero.component.tsx`, `storefront-home.component.tsx`, `storefront.component.tsx`, `storefront-listing.component.tsx`, `storefront-product-grid.component.tsx` e `product-detail.component.tsx` (sai o estado de bairro não atendido e o gate do "+");
  - `shared/components/store/`: `delivery-pill.component.tsx` vira o seletor de lojas, `storefront-header.component.tsx`, `storefront-footer.component.tsx`, `product-card.component.tsx` e `store.types.ts`;
  - `shared/template/storefront-layout.component.tsx`;
  - `modules/orders/pages/checkout.page.tsx` (pré-preenchimento, aviso de cobertura e link de volta);
  - `modules/customers/pages/my-account.page.tsx` e `data/customer-form.util.ts` (padrões de cidade/UF pela loja);
  - `shared/navigation/storefront-routes.ts`;
  - `DESIGN.md`.
- Sem mudanças no backend, no domínio, no banco ou no seed: a change consome `GET /storefront/stores`, que já existe.
- Coordenação: a change `minha-conta`, ainda não arquivada, descreve os padrões de "Minha conta" pelo bairro da vitrine. Os deltas dela são atualizados junto para citar a loja escolhida.
- Links antigos com `?bairro=` continuam abrindo a vitrine, agora na loja padrão ou na lembrada, sem erro.
