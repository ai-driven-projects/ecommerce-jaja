// Banco PRÓPRIO do serviço entregas (regra: nenhum outro serviço lê este arquivo).
import Database from "better-sqlite3";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

export function abrirBanco(dbPath?: string) {
  const db = new Database(dbPath ?? join(aqui, "..", "entregas.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(
    "CREATE TABLE IF NOT EXISTS entregadores (id TEXT PRIMARY KEY, nome TEXT NOT NULL, modal TEXT NOT NULL, hub TEXT NOT NULL, livre INTEGER NOT NULL DEFAULT 1);" +
      // Estado PARCIAL da coordenação por eventos: a_caminho só sai quando
      // atribuida = 1 E separada = 1, em qualquer ordem de chegada.
      "CREATE TABLE IF NOT EXISTS entregas (pedidoId TEXT PRIMARY KEY, hub TEXT NOT NULL, entregadorId TEXT, atribuida INTEGER NOT NULL DEFAULT 0, separada INTEGER NOT NULL DEFAULT 0, aCaminho INTEGER NOT NULL DEFAULT 0, concluidaEm TEXT);"
  );
  const total = db.prepare("SELECT COUNT(*) AS n FROM entregadores").get() as { n: number };
  if (total.n === 0) semear(db);
  return db;
}

function semear(db: Database.Database) {
  const pool: Array<[string, string, string, string]> = [
    ["rafael", "Rafael", "bike", "Hub Aldeota"],
    ["bia", "Bia", "a pé", "Hub Aldeota"],
    ["caio", "Caio", "bike", "Hub Centro"],
    ["marina", "Marina", "a pé", "Hub Centro"],
  ];
  const ins = db.prepare("INSERT INTO entregadores (id, nome, modal, hub, livre) VALUES (?, ?, ?, ?, 1)");
  db.transaction(() => {
    for (const [id, nome, modal, hub] of pool) ins.run(id, nome, modal, hub);
  })();
}
