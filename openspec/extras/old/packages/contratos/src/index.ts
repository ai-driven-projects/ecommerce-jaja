import { z } from "zod";

// Base comum a todo evento do sistema (ver docs/eventos.md).
export const EventoBase = z.object({
  id: z.string().uuid(),
  tipo: z.string(),
  ocorridoEm: z.string().datetime(),
  pedidoId: z.string().uuid().optional(),
});
export type EventoBase = z.infer<typeof EventoBase>;

export const ItemPedido = z.object({
  produtoId: z.string().min(1),
  nome: z.string().min(1),
  precoCentavos: z.number().int().nonnegative(),
  quantidade: z.number().int().positive(),
});
export type ItemPedido = z.infer<typeof ItemPedido>;

// pedido.criado — produtor: pedidos · consumidores: pagamentos
export const PedidoCriado = EventoBase.extend({
  tipo: z.literal("pedido.criado"),
  pedidoId: z.string().uuid(),
  payload: z.object({
    pedidoId: z.string().uuid(),
    numero: z.string().regex(/^\d{4}$/),
    bairro: z.string().min(1),
    hub: z.string().min(1),
    itens: z.array(ItemPedido).min(1),
    totalCentavos: z.number().int().nonnegative(),
  }),
});
export type PedidoCriado = z.infer<typeof PedidoCriado>;

// pagamento.aprovado — produtor: pagamentos · consumidores: pedidos
export const PagamentoAprovado = EventoBase.extend({
  tipo: z.literal("pagamento.aprovado"),
  pedidoId: z.string().uuid(),
  payload: z.object({
    pedidoId: z.string().uuid(),
    meio: z.literal("pix"),
    valorCentavos: z.number().int().nonnegative(),
  }),
});
export type PagamentoAprovado = z.infer<typeof PagamentoAprovado>;

// pedido.confirmado — produtor: pedidos · consumidores: estoque, entregas,
// notificacoes (fan-out) e o próprio pedidos (linha do tempo)
export const PedidoConfirmado = EventoBase.extend({
  tipo: z.literal("pedido.confirmado"),
  pedidoId: z.string().uuid(),
  payload: z.object({
    pedidoId: z.string().uuid(),
    numero: z.string().regex(/^\d{4}$/),
    bairro: z.string().min(1),
    hub: z.string().min(1),
    itens: z.array(ItemPedido).min(1),
    previsaoEntrega: z.string().datetime(),
  }),
});
export type PedidoConfirmado = z.infer<typeof PedidoConfirmado>;

export const ItemReservado = z.object({
  produtoId: z.string().min(1),
  quantidade: z.number().int().positive(),
});
export type ItemReservado = z.infer<typeof ItemReservado>;

// estoque.reservado — produtor: estoque · consumidores: pedidos (→ confirmado),
// catalogo (projeção de leitura da cópia)
export const EstoqueReservado = EventoBase.extend({
  tipo: z.literal("estoque.reservado"),
  pedidoId: z.string().uuid(),
  payload: z.object({
    pedidoId: z.string().uuid(),
    hub: z.string().min(1),
    itens: z.array(ItemReservado).min(1),
  }),
});
export type EstoqueReservado = z.infer<typeof EstoqueReservado>;

// estoque.separado — produtor: estoque · consumidores: entregas, pedidos
export const EstoqueSeparado = EventoBase.extend({
  tipo: z.literal("estoque.separado"),
  pedidoId: z.string().uuid(),
  payload: z.object({ pedidoId: z.string().uuid(), hub: z.string().min(1) }),
});
export type EstoqueSeparado = z.infer<typeof EstoqueSeparado>;

export const Entregador = z.object({
  nome: z.string().min(1),
  modal: z.enum(["bike", "a pé"]),
});
export type Entregador = z.infer<typeof Entregador>;

// entrega.atribuida — produtor: entregas · consumidores: pedidos (rodapé da tela)
export const EntregaAtribuida = EventoBase.extend({
  tipo: z.literal("entrega.atribuida"),
  pedidoId: z.string().uuid(),
  payload: z.object({
    pedidoId: z.string().uuid(),
    entregador: Entregador,
    hub: z.string().min(1),
  }),
});
export type EntregaAtribuida = z.infer<typeof EntregaAtribuida>;

// entrega.a_caminho — só é publicado quando entrega.atribuida E
// estoque.separado do mesmo pedido já chegaram (coordenação por eventos)
export const EntregaACaminho = EventoBase.extend({
  tipo: z.literal("entrega.a_caminho"),
  pedidoId: z.string().uuid(),
  payload: z.object({ pedidoId: z.string().uuid() }),
});
export type EntregaACaminho = z.infer<typeof EntregaACaminho>;

export const EntregaChegando = EventoBase.extend({
  tipo: z.literal("entrega.chegando"),
  pedidoId: z.string().uuid(),
  payload: z.object({
    pedidoId: z.string().uuid(),
    distanciaMetros: z.number().int().nonnegative(),
  }),
});
export type EntregaChegando = z.infer<typeof EntregaChegando>;

export const EntregaConcluida = EventoBase.extend({
  tipo: z.literal("entrega.concluida"),
  pedidoId: z.string().uuid(),
  payload: z.object({
    pedidoId: z.string().uuid(),
    recebidoPor: z.string().min(1),
  }),
});
export type EntregaConcluida = z.infer<typeof EntregaConcluida>;

// notificacao.enviada — produtor: notificacoes · consumidores: ninguém por enquanto
export const NotificacaoEnviada = EventoBase.extend({
  tipo: z.literal("notificacao.enviada"),
  pedidoId: z.string().uuid(),
  payload: z.object({
    pedidoId: z.string().uuid(),
    canal: z.literal("console"),
    tipo: z.enum(["pedido_confirmado", "entrega_concluida"]),
  }),
});
export type NotificacaoEnviada = z.infer<typeof NotificacaoEnviada>;
