// Banco PRÓPRIO do serviço notificacoes.
import Database from "better-sqlite3";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

export function abrirBanco(dbPath?: string) {
  const db = new Database(dbPath ?? join(aqui, "..", "notificacoes.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(
    "CREATE TABLE IF NOT EXISTS notificacoes (id TEXT PRIMARY KEY, pedidoId TEXT NOT NULL, tipo TEXT NOT NULL, canal TEXT NOT NULL, enviadoEm TEXT NOT NULL);"
  );
  return db;
}
