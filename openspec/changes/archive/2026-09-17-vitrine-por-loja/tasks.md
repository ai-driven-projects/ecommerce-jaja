> **Execução:** um subagente de **Frontend** (grupos 1 a 5), com contexto limpo. O grupo 6 é da conversa principal, com o usuário.
>
> **Leitura prévia:** `.claude/skills/skills-standards.md`, `apps/frontend/DESIGN.md`, o `design.md` e as specs desta change, e as referências de código citadas no Contexto do `design.md`.
>
> **Restrições:**
> - não alterar `packages/shared`, o backend, o domínio, o banco nem o seed: `GET /storefront/stores` já existe;
> - não fazer commit nem operações git que mudem o working tree, e não tocar em alterações de outras frentes;
> - não matar o frontend (:3000) nem o backend (:4000) do usuário: usar outras portas;
> - não digitar senhas em formulários: token por `curl` na API de login;
> - nunca imprimir chaves do Google Maps.

## 1. Loja na URL e no estado da vitrine

- [x] 1.1 Em `modules/catalog/data/storefront-query.util.ts`, trocar o parâmetro `bairro` por `loja` (slug) em `parseStorefrontParams`, `buildStorefrontQuery`, `buildStorefrontHref` e `storefrontBaseParams`, ignorando um `bairro` presente na URL (Decisão 1). Verificar com `npx tsc --noEmit` em `apps/frontend` e conferindo que `query` continua preservando categoria, busca, filtros, ordem e página.
- [x] 1.2 Em `modules/catalog/data/storefront.mock.ts` e `storefront.types.ts`, remover `ZONES`, `UNSERVED_NEIGHBORHOODS`, `ETA_BY_NEIGHBORHOOD`, `zoneOf`, `storeOf`, `groupNeighborhoodsByStore` e o tipo `Zone`, mantendo o que não é de bairro (categorias, `COURIERS_ONLINE` e os dados de produto de exemplo ainda usados). Verificar com `grep -rn "ZONES\|zoneOf\|storeOf\|ETA_BY_NEIGHBORHOOD\|UNSERVED_NEIGHBORHOODS\|groupNeighborhoodsByStore" apps/frontend/src` sem resultados.
- [x] 1.3 Reescrever `modules/catalog/data/use-storefront.hook.ts` conforme as Decisões 2 e 5: carregar as lojas ativas com `useStorefrontStores()`, resolver a loja em vigor (URL → escolha lembrada em `localStorage`, com `try/catch` → primeira loja ativa), expor `store` (objeto da loja), `storeSlug`, `stores`, `loadingStores`, `setStore(slug)` (grava na URL sem entrada no histórico e lembra a escolha), `city`/`state` derivados do endereço da loja e `query`. Sai tudo que é bairro (`neighborhood`, `setNeighborhood`, `served`, `etaMinutes`, `neighborhoods`, `servedNeighborhoods`). Verificar com `npm run lint --workspace=@jaja/frontend` e `npx tsc --noEmit`.
- [x] 1.4 Criar a função que lê cidade e UF do fim do endereço da loja (`…, São Paulo/SP` → `{ city: 'São Paulo', state: 'SP' }`; formato diferente → `null`), em `modules/stores/data/` ou `modules/catalog/data/`, com comentário de que é um paliativo até a loja ter cidade/UF estruturadas. Verificar com casos de endereço com e sem o padrão.

## 2. Cabeçalho, rodapé e hero

- [x] 2.1 Transformar `shared/components/store/delivery-pill.component.tsx` no seletor de lojas (nome e cidade/UF da loja em vigor, lista das lojas ativas com a escolhida marcada, sem ETA, sem troca com uma só loja), conforme o delta de `shared/design-system`, ajustando `store.types.ts`, `storefront-header.component.tsx` e `shared/template/storefront-layout.component.tsx`. O rótulo acessível passa a falar de loja. Verificar com `npm run lint --workspace=@jaja/frontend`.
- [x] 2.2 Em `shared/components/store/storefront-footer.component.tsx`, listar as lojas ativas (nome) em vez de bairros, e em `modules/catalog/components/storefront-hero.component.tsx` trocar "De bike e a pé por <bairro>" por um texto que cite a loja escolhida. Verificar com `npm run lint --workspace=@jaja/frontend`.

## 3. Vitrine, detalhe e carrinho sem "não atendido"

- [x] 3.1 Em `modules/catalog/components/`, remover o estado vazio "Ainda não chegamos aí. Já já." e todo o gate por `served` de `storefront.component.tsx`, `storefront-home.component.tsx`, `storefront-listing.component.tsx`, `storefront-product-grid.component.tsx`, `storefront-shell.component.tsx` e `product-detail.component.tsx`, e em `shared/components/store/product-card.component.tsx` (o "+" sempre disponível), conforme o delta de `orders/storefront-cart`. Verificar com `grep -rn "served\|chegamos aí" apps/frontend/src` sem resultados de vitrine e com `npm run lint --workspace=@jaja/frontend`.
- [x] 3.2 Em `modules/catalog/components/product-detail.component.tsx` e onde mais houver, tirar do cartão de entrega e dos textos as menções a bairro e a tempo por bairro, sem inventar número novo. Verificar com `grep -rn "bairro" apps/frontend/src/modules/catalog apps/frontend/src/shared/components/store` sem resultados.

## 4. Checkout e Minha conta

- [x] 4.1 Em `modules/orders/pages/checkout.page.tsx`, trocar o pré-preenchimento (cidade e UF da loja escolhida, bairro vazio), remover o aviso "Dentro da área de cobertura · entrega em ~N min" e fazer o "← Voltar para a loja" preservar `loja` e `categoria`, conforme o delta de `orders/checkout-access`. O ponto do endereço do cliente continua preservado. Verificar com `npm run lint --workspace=@jaja/frontend`.
- [x] 4.2 Em `modules/customers/pages/my-account.page.tsx` e `data/customer-form.util.ts`, usar cidade/UF da loja escolhida como padrão e parar de pré-preencher bairro; o centro do mapa continua pela loja em vigor. Ajustar `shared/navigation/storefront-routes.ts` se ele citar `bairro`. Verificar com `npm run lint --workspace=@jaja/frontend`.
- [x] 4.3 Atualizar `apps/frontend/DESIGN.md` (cabeçalho, vitrine, detalhe, checkout e "Minha conta": seletor de lojas, sem ETA, sem estado de bairro não atendido) e os deltas da change `minha-conta` que citam bairro (`openspec/changes/minha-conta/specs/customers/my-account/spec.md`: cenários com `?loja=` e padrões pela loja escolhida), conforme a Decisão 7. Verificar com `openspec validate minha-conta --strict` e `openspec validate vitrine-por-loja --strict`.

## 5. Validação do frontend

- [x] 5.1 Rodar `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` sem erros.
- [x] 5.2 Validar no navegador, com o backend do usuário em :4000 e um frontend próprio em outra porta:
  - `/` sem parâmetros abre na primeira loja ("Loja Paulista"), sem ETA no cabeçalho;
  - escolher "Loja Rio Branco" grava `?loja=loja-rio-branco`, e recarregar mantém; abrir `/` depois (sem parâmetro) volta nessa loja (escolha lembrada);
  - `?loja=inexistente` e `?bairro=Bela+Vista` abrem na loja padrão, sem erro;
  - o "+" do card e o "Adicionar" do detalhe funcionam com qualquer loja escolhida, e o contador da sacola sobe;
  - a loja escolhida sobrevive ao ir para o detalhe, aplicar filtro, buscar, paginar, ir ao checkout, sair/entrar (`voltar=`) e abrir "Minha conta";
  - no checkout sem cadastro, cidade e UF vêm da loja escolhida e o bairro fica vazio; não há aviso de cobertura;
  - em "Minha conta", o mapa continua abrindo na loja escolhida;
  - 375px sem rolagem horizontal no cabeçalho e no rodapé.

  Devolver os dados de teste ao estado inicial e encerrar os processos que subiu.

## 6. Conferência com o usuário (conversa principal)

- [ ] 6.1 **Não conferido: arquivado a pedido do usuário sem esta conferência.** O usuário confere o seletor de lojas no navegador dele: troca de loja, escolha lembrada, ausência de ETA, rodapé com lojas e o fluxo até o checkout.
