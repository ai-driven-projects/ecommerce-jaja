// Runner de desenvolvimento: UM processo, UM EventBus em memória, todos os
// serviços juntos, cada um na sua porta. Em dev os serviços rodam como um
// monólito modular compartilhando o bus em memória — o broker real e a
// separação em processos vêm no prompt 5.
import { EventBusMemoria } from "@jaja/broker";
import { createService as criarCatalogo } from "@jaja/catalogo";
import { createService as criarEntregas } from "@jaja/entregas";
import { createService as criarEstoque } from "@jaja/estoque";
import { createService as criarNotificacoes } from "@jaja/notificacoes";
import { createService as criarPagamentos } from "@jaja/pagamentos";
import { createService as criarPedidos } from "@jaja/pedidos";

const bus = new EventBusMemoria();

const servicos = [
  { nome: "catalogo", servico: criarCatalogo({ bus, port: 3001 }) },
  { nome: "pedidos", servico: criarPedidos({ bus, port: 3002, catalogoUrl: "http://localhost:3001" }) },
  { nome: "pagamentos", servico: criarPagamentos({ bus, port: 3003 }) },
  { nome: "estoque", servico: criarEstoque({ bus, port: 3004 }) },
  { nome: "entregas", servico: criarEntregas({ bus, port: 3005 }) },
  { nome: "notificacoes", servico: criarNotificacoes({ bus, port: 3006 }) },
];

for (const { nome, servico } of servicos) {
  servico.app
    .listen({ port: servico.port, host: "0.0.0.0" })
    .then(() => console.log(nome + " em http://localhost:" + servico.port));
}
