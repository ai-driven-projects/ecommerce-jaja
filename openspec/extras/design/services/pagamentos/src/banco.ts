// Banco PRÓPRIO do serviço pagamentos. Não lê o banco do pedidos — tudo que
// ele sabe do pedido chega pelo evento pedido.criado.
import Database from "better-sqlite3";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

export function abrirBanco(dbPath?: string) {
  const db = new Database(dbPath ?? join(aqui, "..", "pagamentos.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(
    "CREATE TABLE IF NOT EXISTS pagamentos (id TEXT PRIMARY KEY, pedidoId TEXT NOT NULL, meio TEXT NOT NULL, valorCentavos INTEGER NOT NULL, aprovadoEm TEXT NOT NULL);"
  );
  return db;
}
