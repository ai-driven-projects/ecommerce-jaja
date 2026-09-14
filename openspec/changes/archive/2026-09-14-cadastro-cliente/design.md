## Context

A motivação e o escopo estão em `proposal.md`, e o comportamento nas specs desta change (`customers/customer-registration`, `customers/customer-admin`, `orders/checkout-access` e `admin/admin-api-authorization`). O roteiro de implementação detalhado é o prompt `openspec/extras/prompts/11-cadastro-cliente.md`. Este é o estado atual relevante.

**Domínio**
- `modules/customers` tem só o scaffold gerado sem spec: `src/customers` (`Customers` sem atributos, `CreateCustomers`, `CustomersDTO { id }`, `CustomersRepository`), `test/customers/create-customers.use-case.test.ts`, o mock `in-memory-customers.repository.ts` (falha com `ENTITY_NOT_FOUND`), além de `getModuleName()` com `test/index.test.ts`.
- O shared já oferece `Cpf` (normaliza para dígitos, valida o dígito verificador e tem códigos próprios), `Phone` (8 a 15 dígitos), `Text` (com `minLength`/`maxLength` e códigos sobrescrevíveis por subclasse, como em `ProductName`), `Flag` e `Id`.
- O pacote não depende de `@jaja/auth`, e deve continuar assim.

**Backend**
- `customers.controller.ts` expõe `GET /customers` público, com uma mensagem de exemplo, e `customers.prisma.ts` só expõe o client. `customers.model.prisma` está vazio, e o model `User` (tabela `users`) fica em `auth.model.prisma`.
- Não há guard global: `AuthController` usa `@UseGuards(JwtGuard)` na classe e `@Public()` nos endpoints abertos, e `@AdminOnly()` aplica `JwtGuard` + `AdminGuard`. `JwtStrategy` mapeia `sub` → `AppUser.id`, lido com `@CurrentUser('id')`.
- `brand.prisma.ts` é a referência de adapter:
  - `UNIQUE_VIOLATIONS` por nome de constraint;
  - leitura de `meta.driverAdapterError.cause.constraint`, porque com `@prisma/adapter-pg` o P2002 não traz `meta.target`;
  - `isUuid` antes de ir ao banco;
  - SQL com `folded`/`toPrefixTsQuery` de `modules/catalog/text-search.sql.ts`, importado hoje só por `brand.prisma.ts` e `category.prisma.ts`.
- O seed `auth` faz upsert de 80 usuários por `email` (dois administradores).

**Frontend**
- O módulo "Clientes" aponta para um placeholder (`CustomersDashboardComponent`, sem chamadas à API) e tem `sectionsByModuleId.customers = []`. `withQuery` é uma função privada de `catalog-routes.ts`.
- O validador `v` não tem CPF nem telefone. Os schemas existentes usam VOs do shared (ex.: `login.schema.ts`).
- Faltam as mensagens de `TEXT_TOO_SHORT`, `CPF_*` e `PHONE_*`, e o mapa `CONFLICT_FIELD_BY_CODE` é local a cada hook de formulário.
- `CheckoutForm` (`modules/orders/pages/checkout.page.tsx`):
  - o endereço é mockado (`defaultValue` fixos);
  - `canConfirm = itens > 0 && served && !isConfirming`, e a confirmação usa `nextOrderId`;
  - o bairro vem de `useStorefront()`;
  - `CheckoutGate` troca para `AuthForm` quando a sessão some.

**Specs desatualizadas**
- `orders/checkout-access` ainda descreve "Checkout chega já já.", e o seu Purpose diz que endereço não faz parte da capacidade.
- `admin/admin-api-authorization` lista `/catalog` (removido na change de marca) e `/customers` como públicos.

## Goals / Non-Goals

**Goals:**
- Um único ponto de regra para o cliente (`SaveCustomer`), usado pelo próprio usuário e pela administração, sem que o domínio conheça o módulo `auth`.
- Checkout alimentado por dados reais de cliente, sem mexer no mock de confirmação do pedido.
- Deixar o próximo prompt (pedidos) com `customer.id`, `isActive` e `findCustomerByUserId` prontos para uso.

**Non-Goals:**
- Transação única entre registro de usuário e cliente: são momentos diferentes do fluxo.
- Biblioteca de máscara de input ou de cache de requisições: máscaras e formatação ficam em utilitários locais.
- Sincronizar o Purpose de `orders/checkout-access` via delta. Deltas não alteram o Purpose, então ele é ajustado à mão no arquivo principal, no archive.

## Decisions

### 1. Três etapas sequenciais com contexto limpo
Negócio → Backend → Frontend, cada uma em um subagente com contexto limpo, como pede o prompt. Cada etapa só começa com as validações da anterior passando, porque backend e frontend consomem o `dist` de `@jaja/customers`.

### 2. Substituir o scaffold, no singular
O scaffold `customers` é apagado e `module-aggregate customer --mode example` gera o agregado `customer`. O use case e o teste de exemplo gerados são removidos. O mesmo foi feito com `catalog` na change de marca. Renomear o scaffold existente foi descartado, porque herdaria nomes no plural (`Customers`, `CreateCustomers`) e o mock fora do contrato.

### 3. Cliente guarda só o `userId`; nome e email vêm do usuário
A entidade não tem nome nem email, e as queries fazem join com `users` para montar `CustomerDetailDTO` e `CustomerListItemDTO`. `SaveCustomer` devolve `CustomerDTO` (sem nome e email), porque o domínio não tem esses dados. As telas já conhecem o usuário: a loja pela sessão, e o admin pelo detalhe carregado antes de editar.

Alternativas descartadas:
- Copiar nome e email para `customers`: os dados ficariam desatualizados quando o `auth` permitir alterá-los.
- O controller reler o detalhe após salvar: consulta extra só para devolver dados que a tela já tem.

### 4. Endereço como VO composto, gravado na própria tabela
`CustomerAddress` agrupa `ZipCode`, `StateCode` e os textos, e o banco guarda as colunas em `customers`. Uma tabela `customer_addresses` foi descartada: com um endereço único, só anteciparia a funcionalidade de vários endereços, que está fora do escopo e terá modelo próprio quando existir.

`ZipCode` e `StateCode` têm códigos do módulo (`CUSTOMER_ZIP_CODE_INVALID`, `CUSTOMER_STATE_INVALID`), para o frontend mapear o erro ao campo. Os textos usam `Text` do shared com códigos genéricos, porque o formulário valida os limites antes de enviar.

### 5. `SaveCustomer` único, com dois caminhos de localização
- **Sem `id`**, o cliente é localizado por `findByUserId`: cria se não houver, altera se houver, e **ignora `isActive`**.
- **Com `id`**, é localizado por `findById`: altera, aplica `isActive` e **propaga `CUSTOMER_NOT_FOUND` sem criar**. É diferente de `SaveBrand`, porque todo cliente nasce do próprio usuário.
- `userId` só é usado na criação; na alteração, o vínculo nunca muda.

A regra de `isActive` fica no domínio, e não só no controller, para que nenhum ponto de entrada futuro do cliente consiga reativá-lo.

Alternativas descartadas:
- Dois casos de uso: duplicariam a verificação de CPF e a montagem do endereço.
- Escolher o caminho pelo controller: espalharia a regra entre os dois controllers.

### 6. CPF normalizado antes da checagem de unicidade
`SaveCustomer` chama `Cpf.tryCreate` antes de `findByCpf`. A falha do VO interrompe o fluxo, e a busca usa os 11 dígitos, então `529.982.247-25` e `52998224725` colidem. Buscar pelo texto recebido deixaria passar duplicatas com máscara diferente até a constraint do banco, que devolveria o erro sem a ordem de validação esperada.

### 7. `/me/customer` em vez de `/customers/me`
`CustomerController` (`/customers`, `@AdminOnly()`) declara `GET /customers/:id`. Com `/customers/me`, a resolução dependeria da ordem de registro dos controllers, e um erro de ordem responderia `403` a clientes comuns ao bater na rota administrativa. Um prefixo próprio remove essa dependência.

`MyCustomerController` usa `@UseGuards(JwtGuard)` na classe e `@CurrentUser('id')`, no mesmo padrão de `GET /auth/me`. Os dois controllers compartilham `toInput` e `throwFailure` em `customer-http.ts`, porque o mapeamento de códigos para `404`/`409`/`400` é idêntico.

### 8. Adapter com constraints e busca SQL compartilhada
`CustomerPrisma` segue `BrandPrisma`:
- **Constraints:** `UNIQUE_VIOLATIONS` com `customers_user_id_key` → `CUSTOMER_ALREADY_EXISTS`, `customers_cpf_key` → `CUSTOMER_CPF_ALREADY_EXISTS` e `customers_pkey` → `CUSTOMER_NOT_FOUND`, e, na mesma leitura de constraint do driver adapter, P2003 em `customers_user_id_fkey` → `CUSTOMER_USER_NOT_FOUND`.
- **Soft delete:** `delete` existe só pelo contrato, e todas as buscas filtram `deletedAt: null`.
- **Busca:** `findCustomers` monta SQL com join em `users`, `tsvector` de peso A (nome, email e CPF) e B (telefone e bairro), `ts_rank` e ordenação `users.name COLLATE "pt-BR-x-icu", customers.id`. Termos só com dígitos e pontuação de máscara são reduzidos aos dígitos antes de `toPrefixTsQuery`; sem isso, `529.982` viraria tokens que não casam o CPF gravado.
- **Local da busca SQL:** `text-search.sql.ts` sai de `modules/catalog` para `src/db/`, porque importar de outro módulo acoplaria `customers` ao catálogo.

### 9. Seed com JSON gerado uma vez e versionado
`customers.json` é gerado por um script descartável fora do repositório (CPFs válidos conferidos com `Cpf.tryCreate`), e só o JSON é versionado. A task `customers` roda depois de `auth`, resolve `userEmail` por um mapa carregado com `findMany` e faz `upsert` por `userId` com `update: {}`.

Alternativas descartadas:
- Gerar os dados a cada execução: CPFs mudariam entre máquinas e execuções, quebrando a idempotência e os cenários do `.http`.
- Gerar pelo CLI: não são dados raspados.

### 10. Administração com uma única tela e sem criação
`/admin/customers` passa a ser a lista, e `/admin/customers/[id]` a edição. Não há rota `/new`: `/admin/customers/new` cai em `[id]`, a API responde `404` e a tela volta para a lista com um toaster. `sectionsByModuleId.customers` continua vazio, e o item do módulo já fica ativo nas sub-rotas. `withQuery` vai para `src/shared/navigation/with-query.util.ts`, usado por `catalog-routes.ts` e `customers-routes.ts`.

`customer.schema.ts` valida CPF e telefone com `Cpf.tryCreate`/`Phone.tryCreate` do shared dentro de refinamentos, a mesma fonte de verdade da API, em vez de reimplementar o algoritmo. O mapa código → campo (`cpf`, `phone`, `address.zipCode`, `address.state`) fica em um arquivo único de `data/`, usado pelo formulário do admin e pelo do checkout.

### 11. Passo de entrega do checkout como máquina de estados local
`useMyCustomer()` é chaveado pelo token da sessão:
- `getMyCustomer` converte o `404` com `CUSTOMER_NOT_FOUND` em `null`;
- sem sessão, o estado vira `null` sem chamada;
- trocar de conta recarrega.

O passo 1 alterna entre `carregando | formulário (criação) | resumo | formulário (alteração)`. Os componentes (`customer-delivery-form`, `customer-delivery-summary` e `customer-address-fields`, este compartilhado com o admin) ficam em `modules/customers`, e `checkout.page.tsx` os compõe, como já faz com `auth` e `catalog`. `canConfirm` ganha `hasCustomer && !editing`. "Quem recebe" e "Instruções" continuam como estado local do pedido.

Uma página separada de "meus dados" foi descartada, porque tiraria o cliente do fluxo e contrariaria a regra de o checkout não navegar.

## Risks / Trade-offs

- **[P2003 com o driver adapter pode não trazer a constraint no mesmo lugar do P2002]** → Reusar a mesma leitura de `driverAdapterError`, com fallback pelo código `P2003`. O caso real é raro: token de um usuário que não existe mais no banco, depois de um `migrate reset`.
- **[Tokenização de CPF e telefone no `tsvector`]** → O número de 11 dígitos precisa virar um lexema buscável por prefixo. Coberto pelo cenário do `.http` com `search` por CPF com máscara; se falhar, indexar também uma coluna só de dígitos no documento.
- **[BREAKING `GET /customers`]** → O endpoint de exemplo não tem consumidores: o placeholder do frontend não chamava a API. A delta de `admin-api-authorization` registra a mudança.
- **[Corrida de criação para o mesmo usuário]** → A constraint única de `user_id` barra a segunda, que responde `409 CUSTOMER_ALREADY_EXISTS`. Na loja vira toaster, e um novo carregamento mostra o resumo.
- **[CPFs fictícios podem coincidir com CPFs reais]** → São dados só de desenvolvimento, gerados por algoritmo e sem vínculo com pessoas; o risco é aceito.
- **[Cliente inativo ainda "confirma" o pedido mockado]** → A regra de bloqueio entra com o agregado de pedido; nesta change `isActive` só é gravado e exibido.
- **[Usuário administrador também pode ter cliente ao comprar pela loja]** → Aceito: o vínculo é por usuário, sem distinção de papel. O seed não cria clientes para administradores.
- **[Purpose de `orders/checkout-access` fica desatualizado após o archive]** → Tarefa final de ajustar o Purpose no arquivo principal ao arquivar.

## Migration Plan

1. `npm run build --workspace=@jaja/customers` ao fim da etapa de Negócio.
2. `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name customers_customer`: cria só a tabela `customers`, com a FK para `users`, e não altera colunas de `users`. Depois, `prisma:generate`.
3. `npm run prisma:seed --workspace=@jaja/backend`, idempotente; `--only=customers` roda só a nova task.
4. Rollback em desenvolvimento: reverter o commit e recriar o banco com `prisma migrate reset`. Não há dados de produção.
