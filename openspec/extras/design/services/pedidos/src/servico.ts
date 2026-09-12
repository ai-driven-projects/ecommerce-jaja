import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import type { EventBus, EventoDominio } from "@jaja/broker";
import { PedidoConfirmado, PedidoCriado } from "@jaja/contratos";
import { abrirBanco } from "./banco.js";

type ItemEntrada = { produtoId: string; quantidade: number };
type Corpo = {
  bairro?: string;
  endereco?: string;
  andarSala?: string;
  recebedor?: string;
  itens?: ItemEntrada[];
};

// Máquina de estados do pedido: criado → pago → confirmado → separado →
// a_caminho → chegando → entregue. Cada transição só acontece a partir do
// estado esperado; evento fora de ordem ou repetido é ignorado e logado.
const TRANSICOES: Record<string, { de: string; para: string }> = {
  "pagamento.aprovado": { de: "criado", para: "pago" },
  "estoque.reservado": { de: "pago", para: "confirmado" },
  "estoque.separado": { de: "confirmado", para: "separado" },
  "entrega.a_caminho": { de: "separado", para: "a_caminho" },
  "entrega.chegando": { de: "a_caminho", para: "chegando" },
  "entrega.concluida": { de: "chegando", para: "entregue" },
};
// Eventos que entram só na linha do tempo (eventos_pedido), sem transição.
const SO_LINHA_DO_TEMPO = ["pedido.criado", "pedido.confirmado", "entrega.atribuida"];

export function createService({
  bus,
  dbPath,
  port = 3002,
  catalogoUrl = "http://localhost:3001",
}: { bus: EventBus; dbPath?: string; port?: number; catalogoUrl?: string }) {
  const db = abrirBanco(dbPath);
  const app = Fastify();
  app.register(cors, { origin: true });

  // ---- SSE: conexões abertas por pedido ------------------------------------
  type LinhaEvento = { eventoId: string; pedidoId: string; tipo: string; ocorridoEm: string; payload: unknown };
  const conexoes = new Map<string, Set<ServerResponse>>();
  const enviarSse = (res: ServerResponse, linha: LinhaEvento) =>
    res.write("id: " + linha.eventoId + "\ndata: " + JSON.stringify(linha) + "\n\n");

  const eventosDoPedido = (pedidoId: string): LinhaEvento[] =>
    (
      db
        .prepare(
          "SELECT eventoId, pedidoId, tipo, ocorridoEm, payload FROM eventos_pedido WHERE pedidoId = ? ORDER BY ocorridoEm, rowid"
        )
        .all(pedidoId) as Array<Omit<LinhaEvento, "payload"> & { payload: string }>
    ).map((l) => ({ ...l, payload: JSON.parse(l.payload) as unknown }));

  // Projeção da linha do tempo: grava o evento (dedupe por eventoId) e
  // repassa às conexões SSE vivas do pedido.
  const gravarEvento = (evento: EventoDominio): boolean => {
    const r = db
      .prepare(
        "INSERT OR IGNORE INTO eventos_pedido (eventoId, pedidoId, tipo, ocorridoEm, payload) VALUES (?, ?, ?, ?, ?)"
      )
      .run(evento.id, evento.pedidoId, evento.tipo, evento.ocorridoEm, JSON.stringify(evento.payload ?? null));
    if (r.changes === 0) {
      console.log("[pedidos] evento repetido ignorado: " + evento.tipo + " (" + evento.id + ")");
      return false;
    }
    const linha: LinhaEvento = {
      eventoId: evento.id,
      pedidoId: evento.pedidoId!,
      tipo: evento.tipo,
      ocorridoEm: evento.ocorridoEm,
      payload: evento.payload ?? null,
    };
    for (const res of conexoes.get(evento.pedidoId!) ?? []) enviarSse(res, linha);
    return true;
  };

  const publicarConfirmado = async (pedidoId: string) => {
    const pedido = db.prepare("SELECT numero, bairro, hub, previsaoEntrega FROM pedidos WHERE id = ?").get(pedidoId) as
      { numero: string; bairro: string; hub: string; previsaoEntrega: string };
    const itens = db
      .prepare("SELECT produtoId, nome, precoCentavos, quantidade FROM itens_pedido WHERE pedidoId = ?")
      .all(pedidoId);
    await bus.publish(
      PedidoConfirmado.parse({
        id: randomUUID(),
        tipo: "pedido.confirmado",
        ocorridoEm: new Date().toISOString(),
        pedidoId,
        payload: { pedidoId, numero: pedido.numero, bairro: pedido.bairro, hub: pedido.hub, itens, previsaoEntrega: pedido.previsaoEntrega },
      })
    );
  };

  const aoEvento = async (evento: EventoDominio) => {
    if (!evento.pedidoId) return;
    const transicao = TRANSICOES[evento.tipo];
    if (!transicao) {
      gravarEvento(evento); // só linha do tempo, sem transição
      return;
    }
    const pedido = db.prepare("SELECT status FROM pedidos WHERE id = ?").get(evento.pedidoId) as
      | { status: string }
      | undefined;
    if (!pedido) {
      console.log("[pedidos] evento de pedido desconhecido ignorado: " + evento.tipo);
      return;
    }
    const repetido = db.prepare("SELECT 1 FROM eventos_pedido WHERE eventoId = ?").get(evento.id);
    if (repetido) {
      console.log("[pedidos] evento repetido ignorado: " + evento.tipo + " (" + evento.id + ")");
      return;
    }
    if (pedido.status !== transicao.de) {
      console.log(
        "[pedidos] fora de ordem ignorado: " + evento.tipo + " com status '" + pedido.status + "' (esperava '" + transicao.de + "')"
      );
      return;
    }
    db.prepare("UPDATE pedidos SET status = ?, atualizadoEm = ? WHERE id = ?").run(
      transicao.para,
      new Date().toISOString(),
      evento.pedidoId
    );
    gravarEvento(evento);
    // Pagamento ok E estoque reservado ⇒ o pedido está de pé: confirma.
    if (evento.tipo === "estoque.reservado") await publicarConfirmado(evento.pedidoId);
  };

  const subscriptions = [...Object.keys(TRANSICOES), ...SO_LINHA_DO_TEMPO].map((tipo) =>
    bus.subscribe(tipo, aoEvento)
  );

  const proximoNumero = () => {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM pedidos").get() as { n: number };
    return String(n + 1).padStart(4, "0");
  };

  app.post<{ Body: Corpo }>("/pedidos", async (req, res) => {
    const { bairro, endereco, andarSala, recebedor, itens } = req.body ?? {};
    if (!Array.isArray(itens) || itens.length === 0)
      return res.code(400).send({ erro: "sacola_vazia" });
    if (!endereco || !recebedor)
      return res.code(400).send({ erro: "dados_de_entrega_incompletos" });

    // Consulta síncrona de leitura: zona de entrega + ETA no catalogo.
    const rEta = await fetch(catalogoUrl + "/eta?bairro=" + encodeURIComponent(bairro ?? ""));
    if (!rEta.ok) return res.code(409).send({ erro: "bairro_nao_atendido" });
    const { hub, etaMin } = (await rEta.json()) as { hub: string; etaMin: number };

    // Consulta síncrona de leitura: preços recalculados no servidor a partir
    // do catalogo — nunca confiamos no total vindo do front.
    const itensCompletos = [];
    for (const item of itens) {
      const r = await fetch(
        catalogoUrl + "/produtos/" + encodeURIComponent(item.produtoId) + "?bairro=" + encodeURIComponent(bairro!)
      );
      if (!r.ok) return res.code(400).send({ erro: "produto_invalido", produtoId: item.produtoId });
      const p = (await r.json()) as { slug: string; nome: string; precoCentavos: number };
      itensCompletos.push({
        produtoId: p.slug,
        nome: p.nome,
        precoCentavos: p.precoCentavos,
        quantidade: Math.max(1, Math.trunc(Number(item.quantidade) || 1)),
      });
    }
    const totalCentavos = itensCompletos.reduce((s, i) => s + i.precoCentavos * i.quantidade, 0);

    const pedidoId = randomUUID();
    const numero = proximoNumero();
    const agora = new Date().toISOString();
    const previsaoEntrega = new Date(Date.now() + etaMin * 60000).toISOString();
    db.transaction(() => {
      db.prepare(
        "INSERT INTO pedidos (id, numero, bairro, endereco, andarSala, recebedor, status, totalCentavos, criadoEm, atualizadoEm, hub, previsaoEntrega) VALUES (?, ?, ?, ?, ?, ?, 'criado', ?, ?, ?, ?, ?)"
      ).run(pedidoId, numero, bairro, endereco, andarSala ?? "", recebedor, totalCentavos, agora, agora, hub, previsaoEntrega);
      const insItem = db.prepare(
        "INSERT INTO itens_pedido (pedidoId, produtoId, nome, precoCentavos, quantidade) VALUES (?, ?, ?, ?, ?)"
      );
      for (const i of itensCompletos) insItem.run(pedidoId, i.produtoId, i.nome, i.precoCentavos, i.quantidade);
    })();

    // Dual write proposital: gravamos no banco e publicamos no bus em duas
    // operações separadas, do jeito ingênuo. Se o processo cair entre uma e
    // outra, o pedido existe sem evento. O outbox pattern entra no prompt 5
    // para resolver isso.
    await bus.publish(
      PedidoCriado.parse({
        id: randomUUID(),
        tipo: "pedido.criado",
        ocorridoEm: agora,
        pedidoId,
        payload: { pedidoId, numero, bairro, hub, itens: itensCompletos, totalCentavos },
      })
    );

    return res.code(201).send({ pedidoId, numero });
  });

  app.get<{ Params: { id: string } }>("/pedidos/:id", async (req, res) => {
    const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(req.params.id);
    if (!pedido) return res.code(404).send({ erro: "pedido_nao_encontrado" });
    const itens = db
      .prepare("SELECT produtoId, nome, precoCentavos, quantidade FROM itens_pedido WHERE pedidoId = ?")
      .all(req.params.id);
    return { ...pedido, itens };
  });

  app.get<{ Params: { id: string } }>("/pedidos/:id/eventos", async (req, res) => {
    const existe = db.prepare("SELECT 1 FROM pedidos WHERE id = ?").get(req.params.id);
    if (!existe) return res.code(404).send({ erro: "pedido_nao_encontrado" });
    return eventosDoPedido(req.params.id);
  });

  // SSE: manda o histórico inteiro na conexão e depois cada evento novo ao
  // vivo. Cada mensagem leva id = eventoId (o front deduplica por ele).
  app.get<{ Params: { id: string } }>("/pedidos/:id/stream", (req, res) => {
    const { id } = req.params;
    const existe = db.prepare("SELECT 1 FROM pedidos WHERE id = ?").get(id);
    if (!existe) return res.code(404).send({ erro: "pedido_nao_encontrado" });
    res.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    for (const linha of eventosDoPedido(id)) enviarSse(res.raw, linha);
    if (!conexoes.has(id)) conexoes.set(id, new Set());
    conexoes.get(id)!.add(res.raw);
    const heartbeat = setInterval(() => res.raw.write(": heartbeat\n\n"), 15000);
    req.raw.on("close", () => {
      clearInterval(heartbeat);
      conexoes.get(id)?.delete(res.raw);
    });
  });

  return { app, port, subscriptions };
}
