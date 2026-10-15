# Lacunas da API

O que o backend (`apps/backend`) não oferece e que o app sentiria falta, com o contorno adotado. Cada item
foi conferido no controller (e, quando é regra, no módulo de `modules/*/src`), não na memória. Nenhum item
propõe endpoint para o app chamar: o app só usa o que existe, e mudar o backend está fora do escopo dele.

## 1. Sem lista de pedidos da conta

- **O que falta:** `GET /me/orders` (os pedidos da pessoa). Só existem `POST /me/orders`,
  `GET /me/orders/:id` e `GET /me/orders/:id/stream`; a lista `GET /orders` é do admin.
- **Onde foi conferido:** `apps/backend/src/modules/orders/my-order.controller.ts` (`@Controller('me/orders')`
  com `@Post()`, `@Get(':id')` e `@Sse(':id/stream')`) e `order-admin.controller.ts` (`@AdminOnly()`).
- **Efeito no app:** não há como reabrir um pedido antigo. O acompanhamento (`/cart/orders/:id`) só é aberto
  logo depois do checkout, com o id devolvido pelo `POST /me/orders`.
- **Contorno:** nenhum endereço é guardado no aparelho e não existe tela "Meus pedidos" (também fora do
  escopo do app). O pedido fica na pilha da aba Carrinho enquanto a pessoa não sai dele; a página continua
  acompanhando ao vivo enquanto está aberta.

## 2. Sem recuperação nem troca de senha

- **O que falta:** rotas para esqueci a senha, redefinição por e-mail ou troca da senha pela própria pessoa.
- **Onde foi conferido:** `apps/backend/src/modules/auth/auth.controller.ts` só tem `POST /auth/register`,
  `POST /auth/login` e `GET /auth/me`.
- **Efeito no app:** quem esquece a senha não consegue entrar pelo app.
- **Contorno:** "Entrar" e "Criar conta" não mostram link de recuperação nem de troca (recuperação de senha
  também está fora do escopo do app); a mensagem de credencial inválida continua genérica.

## 3. Token sem renovação

- **O que falta:** renovação do JWT (refresh token ou rota que troque o token antes de vencer).
- **Onde foi conferido:** `apps/backend/src/shared/shared.module.ts` (`signOptions: { expiresIn: '7d' }`) e
  `auth.controller.ts`, sem rota de renovação.
- **Efeito no app:** sete dias depois do acesso, a próxima chamada com o token recebe `401` e a sessão acaba,
  mesmo com o app em uso.
- **Contorno:** o `401` encerra a sessão (`AuthInterceptor` → `Session.expire()`), a guarda leva a "Entrar"
  guardando o destino em `from`, e o carrinho do visitante no aparelho continua intacto.

## 4. Catálogo e preço não dependem da loja

- **O que falta:** um parâmetro de loja nas consultas da vitrine (estoque, preço ou disponibilidade por loja).
- **Onde foi conferido:** `apps/backend/src/modules/catalog/storefront.controller.ts`: `GET
  /storefront/products` aceita só `page`, `pageSize`, `search`, `category`, `brand`, `minPriceCents`,
  `maxPriceCents`, `onSale`, `featured` e `sort`; `GET /storefront/categories` e `GET
  /storefront/products/:slug` não recebem loja.
- **Efeito no app:** trocar de loja não muda o catálogo, os preços nem o que está disponível.
- **Contorno:** como no web, a loja escolhida (`jaja:vitrine:loja`) nunca vai para a API: ela só alimenta o
  seletor do topo da Início e a cidade/UF sugerida nos dados de entrega de quem ainda não tem cadastro.

## Divergências do plano, não lacunas

Diferenças entre o que o plano do app supunha e o que o backend faz. O backend atende; o app segue o backend.

- **Fechamento do pedido em `POST /me/orders`**, não em `/me/cart/orders`: conferido em
  `apps/backend/src/modules/orders/my-order.controller.ts`. O servidor monta o pedido a partir do carrinho
  da conta e do cadastro; o corpo leva só `recipientName` e `deliveryInstructions`.
- **O pedido não exige a `location` do endereço:** `modules/orders/src/order/use-case/place-order.use-case.ts`
  exige só o cadastro ativo (`ORDER_CUSTOMER_REQUIRED`, `ORDER_CUSTOMER_INACTIVE`) e copia o
  `deliveryAddress`; nada em `modules/orders/src` olha a `location`. Por isso cliente novo, sem mapa, salva
  os dados de entrega com `location: null` e consegue comprar.
