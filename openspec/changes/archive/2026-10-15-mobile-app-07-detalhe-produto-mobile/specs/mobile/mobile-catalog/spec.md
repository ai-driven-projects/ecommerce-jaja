## ADDED Requirements

### Requirement: Detalhe do produto por slug
O app SHALL obter o detalhe de um produto de `GET /storefront/products/<slug>`, sem token, com o slug codificado no caminho, e MUST NOT reaproveitar o detalhe entre pedidos. A resposta MUST ser convertida num produto com `id`, `slug`, `name`, `sku` (ou ausente), `description` (ou ausente), preço e preço "De:" em centavos, `discountPercent` (ou ausente), `unit`, `isFeatured`, `brand` (`slug` e `name`, ou ausente), `categories` (`slug` e `name`, da raiz até a do produto, na ordem recebida) e `images` (`thumbUrl`, `largeUrl` e `order`, ordenadas por `order`); campos a mais MUST ser ignorados. `404` MUST virar a falha "não encontrado"; preço negativo ou resposta fora do formato MUST virar falha inesperada.

#### Scenario: Produto convertido
- **WHEN** a API responde `200` com `priceCents: 3490`, `listPriceCents: 4990`, `brand: {"slug": "hp", "name": "HP"}`, `categories` com "Cartuchos & Toners" e "Toners HP", e imagens de `order` 1 e 0, nessa ordem
- **THEN** o app tem o produto com preço `R$ 34,90`, preço anterior `R$ 49,90`, marca HP, a trilha na ordem recebida e a imagem de `order` 0 primeiro

#### Scenario: Slug inexistente
- **WHEN** o app pede `GET /storefront/products/nao-existe` e a API responde `404`
- **THEN** o resultado é a falha "não encontrado", sem exceção

#### Scenario: Slug com caracteres especiais
- **WHEN** o app pede o produto de slug `caneta x`
- **THEN** a requisição sai para `/storefront/products/caneta%20x`
