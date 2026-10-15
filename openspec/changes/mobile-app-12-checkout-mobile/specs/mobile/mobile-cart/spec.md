## MODIFIED Requirements

### Requirement: Resumo e entrega do carrinho
Abaixo das linhas, a aba SHALL mostrar o subtotal, a entrega ("Grátis" quando a taxa é 0, senão o valor), "Faltam <valor> para a entrega grátis." enquanto a entrega é cobrada, o total, todos da prévia, e a ação principal "Finalizar pedido · <total>", que abre o checkout na pilha da aba. A ação MUST ficar desabilitada enquanto uma mudança não foi confirmada e enquanto houver linha indisponível. Com linhas indisponíveis, MUST aparecer "Remova os itens indisponíveis para continuar.". Enquanto uma mudança não foi confirmada por uma prévia, os valores MUST ser sinalizados como em atualização.

#### Scenario: Entrega cobrada
- **WHEN** a prévia devolve subtotal 2580, entrega 490, total 3070 e faltam 5320 centavos
- **THEN** a aba mostra `R$ 25,80`, `R$ 4,90`, "Faltam R$ 53,20 para a entrega grátis." e "Finalizar pedido · R$ 30,70"

#### Scenario: Entrega grátis
- **WHEN** a prévia devolve subtotal 7900 e entrega 0
- **THEN** a entrega aparece como "Grátis" e o aviso de quanto falta não aparece

#### Scenario: Abrir o checkout
- **WHEN** o carrinho tem linhas disponíveis, sem mudança pendente, e a pessoa toca em "Finalizar pedido · R$ 30,70"
- **THEN** o checkout é aberto (passando por "Entrar" quando não há sessão)

#### Scenario: Linha indisponível bloqueia
- **WHEN** a prévia devolve uma linha com `isAvailable: false`
- **THEN** "Finalizar pedido" fica desabilitado e aparece "Remova os itens indisponíveis para continuar."
