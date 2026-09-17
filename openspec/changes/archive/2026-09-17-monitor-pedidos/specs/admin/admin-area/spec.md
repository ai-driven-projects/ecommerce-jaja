## MODIFIED Requirements

### Requirement: Dashboard administrativo inicial
A rota `/admin` SHALL exibir um dashboard com:
- a saudação ao usuário logado pelo primeiro nome e a data;
- quatro indicadores vindos do resumo de pedidos (`orders/order-admin`):
  - "Pedidos hoje", com "`N` entregues" abaixo;
  - "Em andamento";
  - "Ticket médio hoje", ou "—" sem pedidos hoje;
  - "Tempo até a entrega", em minutos, ou segundos abaixo de 1 min, ou "—" sem entregas hoje;
- o cartão "Pedidos em andamento", com os últimos pedidos em andamento (Pedido, Cliente, Destino, Status e Atualizado), o indicador ao vivo e o link "Ver todos" para `/admin/orders`. Cada linha leva ao painel do pedido. Sem pedidos em andamento, mostra "Nenhum pedido em andamento agora.";
- entregadores online e "Estoque baixo", que continuam com dados locais de exemplo.

Indicadores e "Pedidos em andamento" MUST ser atualizados ao vivo, sem recarregar, pela conexão ao vivo do admin. O dashboard MUST NOT exibir pedidos, indicadores de pedidos nem o gráfico "Tempo médio por hora" com dados de exemplo. Valores monetários MUST seguir o formato `R$ 12,90`.

#### Scenario: Dashboard aberto
- **WHEN** o administrador "Ana Souza" acessa `/admin`
- **THEN** vê a saudação com "Ana", os quatro indicadores com os números de hoje vindos da API, "Pedidos em andamento" com os pedidos reais e o estoque baixo, sem nenhum pedido de exemplo

#### Scenario: Sem pedidos
- **WHEN** não há pedidos e o administrador acessa `/admin`
- **THEN** "Pedidos hoje" e "Em andamento" mostram 0, "Ticket médio hoje" e "Tempo até a entrega" mostram "—", e "Pedidos em andamento" mostra "Nenhum pedido em andamento agora."

#### Scenario: Pedido em andamento ao vivo
- **WHEN** o administrador está em `/admin` e a cliente confirma um pedido
- **THEN** sem recarregar, "Pedidos hoje" e "Em andamento" aumentam, o pedido aparece em "Pedidos em andamento" e, quando é entregue, sai do cartão, e "Tempo até a entrega" passa a considerá-lo
