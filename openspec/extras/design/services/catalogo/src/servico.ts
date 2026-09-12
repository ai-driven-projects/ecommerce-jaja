// Rotas do catalogo — consultas SÍNCRONAS DE LEITURA (exceção documentada
// nas regras de arquitetura: zona de entrega, catálogo e preço/ETA).
// Desde o prompt 4 o catalogo também ASSINA estoque.reservado para manter
// sua cópia de leitura do estoque (o dono do número é o serviço estoque).
import Fastify from "fastify";
import cors from "@fastify/cors";
import type { EventBus } from "@jaja/broker";
import { abrirBanco } from "./banco.js";

type Bairro = { nome: string; hubId: string; deslocamentoMin: number };
type Hub = { id: string; nome: string; preparoMin: number };
type ProdutoLinha = {
  id: string;
  nome: string;
  categoria: string;
  precoCentavos: number;
  unidadeVenda: string;
  descricao: string;
  ficha: string;
};

export function createService({
  bus,
  dbPath,
  port = 3001,
}: { bus?: EventBus; dbPath?: string; port?: number } = {}) {
  const db = abrirBanco(dbPath);
  const app = Fastify();
  app.register(cors, { origin: true });

  const acharBairro = (nome: string | undefined): Bairro | undefined =>
    nome ? (db.prepare("SELECT * FROM bairros WHERE nome = ?").get(nome) as Bairro | undefined) : undefined;

  const bairrosAtendidos = () =>
    db
      .prepare(
        "SELECT b.nome AS bairro, h.nome AS hub FROM bairros b JOIN hubs h ON h.id = b.hubId ORDER BY h.nome, b.nome"
      )
      .all();

  app.get("/zonas", async () => bairrosAtendidos());

  app.get<{ Querystring: { bairro?: string } }>("/produtos", async (req, res) => {
    const bairro = acharBairro(req.query.bairro);
    if (!bairro)
      return res.code(404).send({ erro: "bairro_nao_atendido", bairrosAtendidos: bairrosAtendidos() });
    return db
      .prepare(
        "SELECT p.id AS slug, p.nome, p.categoria, p.precoCentavos, e.quantidade FROM produtos p JOIN estoque e ON e.produtoId = p.id WHERE e.hubId = ? AND e.quantidade > 0 ORDER BY p.categoria, p.nome"
      )
      .all(bairro.hubId);
  });

  app.get<{ Params: { slug: string }; Querystring: { bairro?: string } }>(
    "/produtos/:slug",
    async (req, res) => {
      const bairro = acharBairro(req.query.bairro);
      if (!bairro)
        return res.code(404).send({ erro: "bairro_nao_atendido", bairrosAtendidos: bairrosAtendidos() });
      const produto = db
        .prepare("SELECT * FROM produtos WHERE id = ?")
        .get(req.params.slug) as ProdutoLinha | undefined;
      if (!produto) return res.code(404).send({ erro: "produto_nao_encontrado" });

      // O estoque aqui é uma foto do momento, consulta síncrona de leitura.
      // A reserva de verdade acontece por evento depois do pedido
      // (estoque.reservado / estoque.insuficiente), então esse número pode
      // estar defasado quando o cliente fechar a compra. Isso é intencional
      // e será discutido em aula.
      const hub = db.prepare("SELECT * FROM hubs WHERE id = ?").get(bairro.hubId) as Hub;
      const estoque = db
        .prepare("SELECT quantidade FROM estoque WHERE produtoId = ? AND hubId = ?")
        .get(produto.id, hub.id) as { quantidade: number } | undefined;
      const relacionados = db
        .prepare(
          "SELECT p.id AS slug, p.nome, p.categoria, p.precoCentavos FROM produtos p JOIN estoque e ON e.produtoId = p.id WHERE p.categoria = ? AND p.id <> ? AND e.hubId = ? AND e.quantidade > 0 ORDER BY p.nome LIMIT 3"
        )
        .all(produto.categoria, produto.id, hub.id);

      return {
        slug: produto.id,
        nome: produto.nome,
        categoria: produto.categoria,
        precoCentavos: produto.precoCentavos,
        unidadeVenda: produto.unidadeVenda,
        descricao: produto.descricao,
        ficha: JSON.parse(produto.ficha) as Array<[string, string]>,
        hub: hub.nome,
        estoque: estoque?.quantidade ?? 0,
        relacionados,
      };
    }
  );

  app.get<{ Querystring: { bairro?: string } }>("/eta", async (req, res) => {
    const bairro = acharBairro(req.query.bairro);
    if (!bairro)
      return res.code(404).send({ erro: "bairro_nao_atendido", bairrosAtendidos: bairrosAtendidos() });
    const hub = db.prepare("SELECT * FROM hubs WHERE id = ?").get(bairro.hubId) as Hub;
    return { bairro: bairro.nome, hub: hub.nome, etaMin: hub.preparoMin + bairro.deslocamentoMin };
  });

  // Projeção de leitura alimentada por eventos: o serviço estoque é o dono
  // do número; aqui só atualizamos a cópia de leitura para o detalhe do
  // produto refletir os pedidos.
  const subscriptions: Array<() => void> = [];
  if (bus) {
    subscriptions.push(
      bus.subscribe("estoque.reservado", (evento) => {
        const { hub, itens } = evento.payload as {
          hub: string;
          itens: Array<{ produtoId: string; quantidade: number }>;
        };
        const hubLinha = db.prepare("SELECT id FROM hubs WHERE nome = ?").get(hub) as { id: string } | undefined;
        if (!hubLinha) return;
        const baixar = db.prepare(
          "UPDATE estoque SET quantidade = MAX(quantidade - ?, 0) WHERE produtoId = ? AND hubId = ?"
        );
        for (const item of itens) baixar.run(item.quantidade, item.produtoId, hubLinha.id);
      })
    );
  }

  return { app, port, subscriptions };
}
