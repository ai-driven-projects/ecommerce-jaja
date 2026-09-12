// Banco PRÓPRIO do serviço estoque. A partir do prompt 4 o ESTOQUE é o dono
// do número por hub; o catalogo mantém só uma cópia de leitura (projeção
// alimentada por estoque.reservado). O seed replica de propósito as
// quantidades iniciais do catalogo — mesmo ponto de partida, donos diferentes.
import Database from "better-sqlite3";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

export function abrirBanco(dbPath?: string) {
  const db = new Database(dbPath ?? join(aqui, "..", "estoque.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(
    "CREATE TABLE IF NOT EXISTS estoque (produtoId TEXT NOT NULL, hub TEXT NOT NULL, quantidade INTEGER NOT NULL, PRIMARY KEY (produtoId, hub));" +
      // Estado que o estoque guarda do pedido (chega por pedido.criado) para
      // conseguir reservar quando pagamento.aprovado chegar.
      "CREATE TABLE IF NOT EXISTS pedidos_pendentes (pedidoId TEXT PRIMARY KEY, hub TEXT NOT NULL, itens TEXT NOT NULL);" +
      "CREATE TABLE IF NOT EXISTS reservas (pedidoId TEXT PRIMARY KEY, hub TEXT NOT NULL, itens TEXT NOT NULL, reservadoEm TEXT NOT NULL, separadoEm TEXT);"
  );
  const total = db.prepare("SELECT COUNT(*) AS n FROM estoque").get() as { n: number };
  if (total.n === 0) semear(db);
  return db;
}

// [slug, Hub Aldeota, Hub Centro] — mesmas quantidades do seed do catalogo.
const SEED: Array<[string, number, number]> = [
  ["caderno-pautado-a5", 14, 9],
  ["caneta-gel", 40, 35],
  ["bloco-adesivo", 22, 18],
  ["marca-texto", 30, 12],
  ["clipes-n2", 25, 25],
  ["envelope-pardo-a4", 16, 0],
  ["papel-a4-500-folhas", 20, 26],
  ["cartucho-tinta-preto", 6, 0],
  ["etiquetas-a4", 10, 8],
  ["papel-fotografico", 7, 5],
  ["cafe-coado-1l", 12, 15],
  ["capsulas-cafe", 18, 14],
  ["pao-de-queijo", 10, 12],
  ["biscoito-amanteigado", 20, 20],
  ["agua-mineral", 48, 40],
  ["barra-cereal", 24, 0],
  ["alcool-gel-500ml", 15, 18],
  ["lencos-umedecidos", 14, 10],
  ["pano-multiuso", 12, 12],
  ["sabonete-refil", 9, 7],
  ["cabo-usb-c", 11, 9],
  ["mouse-usb", 0, 6],
  ["pilhas-aa", 26, 22],
  ["fone-com-fio", 8, 4],
];

function semear(db: Database.Database) {
  const ins = db.prepare("INSERT INTO estoque (produtoId, hub, quantidade) VALUES (?, ?, ?)");
  db.transaction(() => {
    for (const [slug, aldeota, centro] of SEED) {
      ins.run(slug, "Hub Aldeota", aldeota);
      ins.run(slug, "Hub Centro", centro);
    }
  })();
}
