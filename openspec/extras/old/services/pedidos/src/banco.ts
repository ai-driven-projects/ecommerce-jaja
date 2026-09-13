// Banco PRÓPRIO do serviço pedidos (regra: nenhum outro serviço lê este arquivo).
import Database from "better-sqlite3";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

export function abrirBanco(dbPath?: string) {
  const db = new Database(dbPath ?? join(aqui, "..", "pedidos.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(
    "CREATE TABLE IF NOT EXISTS pedidos (id TEXT PRIMARY KEY, numero TEXT NOT NULL, bairro TEXT NOT NULL, endereco TEXT NOT NULL, andarSala TEXT, recebedor TEXT NOT NULL, status TEXT NOT NULL, totalCentavos INTEGER NOT NULL, criadoEm TEXT NOT NULL, atualizadoEm TEXT NOT NULL, hub TEXT NOT NULL DEFAULT '', previsaoEntrega TEXT);" +
      "CREATE TABLE IF NOT EXISTS itens_pedido (pedidoId TEXT NOT NULL REFERENCES pedidos(id), produtoId TEXT NOT NULL, nome TEXT NOT NULL, precoCentavos INTEGER NOT NULL, quantidade INTEGER NOT NULL);" +
      // Projeção da linha do tempo: todo evento consumido do pedido, com
      // dedupe por eventoId (PRIMARY KEY).
      "CREATE TABLE IF NOT EXISTS eventos_pedido (eventoId TEXT PRIMARY KEY, pedidoId TEXT NOT NULL, tipo TEXT NOT NULL, ocorridoEm TEXT NOT NULL, payload TEXT NOT NULL);"
  );
  // Migração ingênua: colunas novas do prompt 4 em bancos antigos.
  const colunas = (db.prepare("PRAGMA table_info(pedidos)").all() as Array<{ name: string }>).map((c) => c.name);
  if (!colunas.includes("hub")) db.exec("ALTER TABLE pedidos ADD COLUMN hub TEXT NOT NULL DEFAULT ''");
  if (!colunas.includes("previsaoEntrega")) db.exec("ALTER TABLE pedidos ADD COLUMN previsaoEntrega TEXT");
  return db;
}
