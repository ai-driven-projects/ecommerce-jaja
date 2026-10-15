## Why

O app já tem sessão e carrinho da conta (etapas 8 a 10), mas o cliente ainda não consegue informar para onde o pedido vai: o checkout da etapa 12 exige o cadastro de cliente (`ORDER_CUSTOMER_REQUIRED`). Esta é a etapa 11 de 15 do loop `mobile-app`: levar para o app os dados de entrega da página "Minha conta" do web (spec `customers/my-account`, `customer.api.ts`, `customer.schema.ts`), sobre o contrato de `MyCustomerController` (`GET`/`PUT /me/customer`), **sem mapa**.

## What Changes

- Novo domínio `customer` no app: cadastro de cliente (CPF, telefone e endereço de entrega com o ponto que veio do backend), o contrato do repositório e os value objects de CPF, telefone, CEP, UF e texto com limites, com as regras copiadas de `packages/shared` e `modules/customers/src`.
- Cliente de `GET /me/customer` (`404` vira "sem cadastro") e `PUT /me/customer`. O corpo sempre leva `address.location`: o ponto que veio do backend no cadastro carregado, ou `null` no cliente novo. O app nunca cria, muda nem apaga o ponto.
- Tela "Dados de entrega", aberta pela aba Conta com sessão: nome e e-mail da conta só para leitura, CPF, telefone e os campos do endereço com máscara e limites, "Salvar dados" (desabilitado sem alteração, "Salvando…" durante o envio), "Descartar alterações" e a confirmação "Dados salvos". Sem cadastro, o texto "Preencha uma vez e seus pedidos saem mais rápido." e a cidade/UF da loja escolhida já preenchidas.
- Recusas do backend viram erro no campo (CPF já cadastrado, CPF, telefone, CEP e UF inválidos); as outras viram mensagem do formulário.
- A rota da tela exige sessão: sem sessão leva a "Entrar" e volta para ela depois.
- O `BlockState` sobe para `ui/shared/`, porque esta tela é o segundo consumidor fora do catálogo, como o `CLAUDE.md` manda.
- Testes de value objects, DTO, repositório (preservação da `location`), caso de uso, ViewModel, tela, aba Conta e rota.

## Capabilities

### New Capabilities
- `mobile/mobile-customer`: dados de entrega do cliente no app: acesso com sessão, carga, formulário, validação, gravação com o ponto preservado e estados da tela.

### Modified Capabilities
- `mobile/mobile-session`: a aba Conta com sessão ganha a entrada "Dados de entrega".

## Impact

- **Código:** só `apps/mobile/**`: `lib/core/value_objects/`, `lib/modules/customer/`, `lib/infra/{api,customer,di}/`, `lib/app/router/`, `lib/ui/modules/{customer,auth}/`, `lib/ui/shared/` (o `BlockState`), `CLAUDE.md` e `test/**`.
- **Dependências:** nenhuma nova.
- **API:** `GET /me/customer` e `PUT /me/customer`, com Bearer pelo interceptor da etapa 8. Nenhum parâmetro novo.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
