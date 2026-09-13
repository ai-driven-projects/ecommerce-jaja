// Banco PRÓPRIO do serviço catalogo (regra: nenhum outro serviço lê este arquivo).
import Database from "better-sqlite3";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

export function abrirBanco(dbPath?: string) {
  const db = new Database(dbPath ?? join(aqui, "..", "catalogo.sqlite"));
  db.pragma("journal_mode = WAL");

// Migração ingênua: se o schema antigo (sem descricao) existir, recria tudo.
const colunas = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='produtos'").all();
if (colunas.length > 0) {
  const temDescricao = (db.prepare("PRAGMA table_info(produtos)").all() as Array<{ name: string }>).some(
    (c) => c.name === "descricao"
  );
  if (!temDescricao)
    db.exec("DROP TABLE estoque; DROP TABLE produtos; DROP TABLE bairros; DROP TABLE hubs;");
}

db.exec(
  "CREATE TABLE IF NOT EXISTS hubs (id TEXT PRIMARY KEY, nome TEXT NOT NULL, preparoMin INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS bairros (nome TEXT PRIMARY KEY, hubId TEXT NOT NULL REFERENCES hubs(id), deslocamentoMin INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS produtos (id TEXT PRIMARY KEY, nome TEXT NOT NULL, categoria TEXT NOT NULL, precoCentavos INTEGER NOT NULL, unidadeVenda TEXT NOT NULL, descricao TEXT NOT NULL, ficha TEXT NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS estoque (produtoId TEXT NOT NULL REFERENCES produtos(id), hubId TEXT NOT NULL REFERENCES hubs(id), quantidade INTEGER NOT NULL, PRIMARY KEY (produtoId, hubId));"
);

  const total = db.prepare("SELECT COUNT(*) AS n FROM hubs").get() as { n: number };
  if (total.n === 0) semear(db);
  return db;
}

type Par = [string, string];
type SeedProduto = {
  slug: string;
  nome: string;
  categoria: string;
  precoCentavos: number;
  unidadeVenda: string;
  descricao: string;
  ficha: Par[];
  estoque: { aldeota: number; centro: number };
};

function semear(db: Database.Database) {
  const hubs = [
    { id: "aldeota", nome: "Hub Aldeota", preparoMin: 8 },
    { id: "centro", nome: "Hub Centro", preparoMin: 10 },
  ];
  const bairros: Array<[string, string, number]> = [
    ["Aldeota", "aldeota", 6],
    ["Meireles", "aldeota", 9],
    ["Dionísio Torres", "aldeota", 8],
    ["Joaquim Távora", "aldeota", 10],
    ["Cocó", "aldeota", 12],
    ["Centro", "centro", 5],
    ["Benfica", "centro", 9],
    ["Jacarecanga", "centro", 11],
    ["José Bonifácio", "centro", 8],
    ["Farias Brito", "centro", 10],
  ];

  const p = (
    slug: string, nome: string, categoria: string, precoCentavos: number, unidadeVenda: string,
    descricao: string, ficha: Par[], aldeota: number, centro: number
  ): SeedProduto => ({ slug, nome, categoria, precoCentavos, unidadeVenda, descricao, ficha, estoque: { aldeota, centro } });

  const produtos: SeedProduto[] = [
    p("caderno-pautado-a5", "Caderno pautado A5", "papelaria", 1290, "a unidade",
      "Pauta firme pra reunião que rende.", [["Formato", "A5"], ["Folhas", "96"], ["Papel", "63 g/m²"]], 14, 9),
    p("caneta-gel", "Caneta gel preta", "papelaria", 490, "a unidade",
      "Tinta que desliza e seca antes da assinatura.", [["Ponta", "0,7 mm"], ["Cor", "preta"]], 40, 35),
    p("bloco-adesivo", "Bloco adesivo 76 mm", "papelaria", 890, "o bloco",
      "Lembrete que fica onde você colou.", [["Formato", "76 × 76 mm"], ["Folhas", "100"]], 22, 18),
    p("marca-texto", "Marca-texto amarelo", "papelaria", 650, "a unidade",
      "Amarelo que grita sem borrar.", [["Ponta", "chanfrada"], ["Cor", "amarelo"]], 30, 12),
    p("clipes-n2", "Clipes nº 2 (cx. 100)", "papelaria", 420, "a caixa",
      "Cem clipes pra segurar qualquer pauta.", [["Unidade", "caixa com 100"], ["Tamanho", "nº 2"]], 25, 25),
    p("envelope-pardo-a4", "Envelope pardo A4 (10 un.)", "papelaria", 780, "o pacote",
      "Dez envelopes prontos pra circular.", [["Unidade", "pacote com 10"], ["Formato", "A4"]], 16, 0),
    p("papel-a4-500-folhas", "Papel A4 (500 folhas)", "impressão", 2890, "a caixa",
      "A resma que segura a semana da impressora.", [["Unidade", "caixa com 500 folhas"], ["Gramatura", "75 g/m²"], ["Formato", "A4"]], 20, 26),
    p("cartucho-tinta-preto", "Cartucho de tinta preto", "impressão", 7990, "o cartucho",
      "Preto novo pra impressora não fazer drama.", [["Cor", "preto"], ["Rendimento", "~400 páginas"]], 6, 0),
    p("etiquetas-a4", "Etiquetas adesivas A4 (25 fl.)", "impressão", 1590, "o pacote",
      "Etiqueta que cola reta de primeira.", [["Unidade", "25 folhas"], ["Etiquetas por folha", "14"]], 10, 8),
    p("papel-fotografico", "Papel fotográfico (20 fl.)", "impressão", 2190, "o pacote",
      "Brilho de foto na impressora comum.", [["Unidade", "20 folhas"], ["Gramatura", "180 g/m²"]], 7, 5),
    p("cafe-coado-1l", "Café coado (garrafa 1 L)", "café e lanches", 1490, "a garrafa",
      "Passado no hub, chega ainda quente.", [["Volume", "1 L"], ["Torra", "média"]], 12, 15),
    p("capsulas-cafe", "Cápsulas de café (10 un.)", "café e lanches", 1890, "a caixa",
      "Dez doses pra máquina do escritório.", [["Unidade", "10 cápsulas"], ["Torra", "escura"]], 18, 14),
    p("pao-de-queijo", "Pão de queijo (6 un.)", "café e lanches", 1200, "o pacote",
      "Seis unidades, assadas na hora.", [["Unidade", "6 un."], ["Servir", "quente"]], 10, 12),
    p("biscoito-amanteigado", "Biscoito amanteigado", "café e lanches", 850, "o pacote",
      "Manteiga de verdade, café à altura.", [["Peso", "150 g"]], 20, 20),
    p("agua-mineral", "Água mineral 510 ml", "café e lanches", 350, "a garrafa",
      "Gelada, sem gás, sem conversa.", [["Volume", "510 ml"], ["Gás", "não"]], 48, 40),
    p("barra-cereal", "Barra de cereal (3 un.)", "café e lanches", 690, "o pacote",
      "Três barras pra segurar a tarde.", [["Unidade", "3 un."], ["Sabor", "aveia e mel"]], 24, 0),
    p("alcool-gel-500ml", "Álcool em gel 500 ml", "limpeza de escritório", 1190, "o frasco",
      "Limpa a mesa e a consciência.", [["Volume", "500 ml"], ["Concentração", "70%"]], 15, 18),
    p("lencos-umedecidos", "Lenços umedecidos (50 un.)", "limpeza de escritório", 990, "o pote",
      "Cinquenta lenços pra teclado e telas.", [["Unidade", "50 lenços"]], 14, 10),
    p("pano-multiuso", "Pano multiuso (5 un.)", "limpeza de escritório", 760, "o pacote",
      "Cinco panos que aguentam o rojão.", [["Unidade", "5 panos"], ["Material", "viscose"]], 12, 12),
    p("sabonete-refil", "Sabonete líquido (refil)", "limpeza de escritório", 1090, "o refil",
      "Refil pra copa não ficar na mão.", [["Volume", "800 ml"], ["Fragrância", "neutra"]], 9, 7),
    p("cabo-usb-c", "Cabo USB-C 1 m", "tecnologia básica", 2490, "a unidade",
      "Um metro de carga sem mau contato.", [["Comprimento", "1 m"], ["Conector", "USB-C"]], 11, 9),
    p("mouse-usb", "Mouse USB básico", "tecnologia básica", 3590, "a unidade",
      "Plugou, funcionou. Sem par nem software.", [["Conexão", "USB com fio"], ["Botões", "3"]], 0, 6),
    p("pilhas-aa", "Pilhas AA (4 un.)", "tecnologia básica", 1690, "a cartela",
      "Quatro alcalinas pro teclado sem fio.", [["Unidade", "4 pilhas"], ["Tipo", "AA alcalina"]], 26, 22),
    p("fone-com-fio", "Fone de ouvido com fio", "tecnologia básica", 2990, "a unidade",
      "Call sem depender de bateria.", [["Conector", "P2"], ["Cabo", "1,2 m"]], 8, 4),
  ];

  const insHub = db.prepare("INSERT INTO hubs (id, nome, preparoMin) VALUES (?, ?, ?)");
  const insBairro = db.prepare("INSERT INTO bairros (nome, hubId, deslocamentoMin) VALUES (?, ?, ?)");
  const insProduto = db.prepare(
    "INSERT INTO produtos (id, nome, categoria, precoCentavos, unidadeVenda, descricao, ficha) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const insEstoque = db.prepare("INSERT INTO estoque (produtoId, hubId, quantidade) VALUES (?, ?, ?)");

  db.transaction(() => {
    for (const h of hubs) insHub.run(h.id, h.nome, h.preparoMin);
    for (const [nome, hubId, min] of bairros) insBairro.run(nome, hubId, min);
    for (const prod of produtos) {
      insProduto.run(prod.slug, prod.nome, prod.categoria, prod.precoCentavos, prod.unidadeVenda, prod.descricao, JSON.stringify(prod.ficha));
      insEstoque.run(prod.slug, "aldeota", prod.estoque.aldeota);
      insEstoque.run(prod.slug, "centro", prod.estoque.centro);
    }
  })();
}
