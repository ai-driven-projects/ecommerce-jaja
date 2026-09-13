import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Barra } from "../componentes/Barra";
import { ImagemCategoria } from "../componentes/ImagemCategoria";
import s from "./Vitrine.module.css";

type Zona = { bairro: string; hub: string };
type Produto = { slug: string; nome: string; categoria: string; precoCentavos: number };

const CATEGORIAS = [
  "todas",
  "papelaria",
  "impressão",
  "café e lanches",
  "limpeza de escritório",
  "tecnologia básica",
];

const preco = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");

export function Vitrine() {
  const [params, setParams] = useSearchParams();
  const bairro = params.get("bairro") ?? "Aldeota";
  const categoria = params.get("categoria") ?? "todas";
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [atendido, setAtendido] = useState(true);

  const definir = (chave: string, valor: string) =>
    setParams(
      (anterior) => {
        anterior.set(chave, valor);
        return anterior;
      },
      { replace: true }
    );

  useEffect(() => {
    document.title = "já já.";
    fetch("/api/catalogo/zonas").then((r) => r.json()).then(setZonas);
  }, []);

  useEffect(() => {
    fetch("/api/catalogo/produtos?bairro=" + encodeURIComponent(bairro)).then(async (r) => {
      if (!r.ok) {
        setAtendido(false);
        setProdutos([]);
        return;
      }
      setAtendido(true);
      setProdutos(await r.json());
    });
  }, [bairro]);

  const visiveis = useMemo(
    () => produtos.filter((p) => categoria === "todas" || p.categoria === categoria),
    [produtos, categoria]
  );

  const hubs = useMemo(() => {
    const porHub = new Map<string, string[]>();
    for (const z of zonas) porHub.set(z.hub, [...(porHub.get(z.hub) ?? []), z.bairro]);
    return [...porHub.entries()];
  }, [zonas]);

  const query = "?bairro=" + encodeURIComponent(bairro) + "&categoria=" + encodeURIComponent(categoria);

  return (
    <div>
      <Barra bairro={bairro} aoTrocarBairro={(b) => definir("bairro", b)} />
      {atendido ? (
        <>
          <nav className={s.filtros} aria-label="Categorias">
            {CATEGORIAS.map((c) => (
              <button
                key={c}
                className={c === categoria ? s.filtro + " " + s.filtroAtivo : s.filtro}
                onClick={() => definir("categoria", c)}
              >
                {c}
              </button>
            ))}
          </nav>
          <main className={s.grade}>
            {visiveis.map((p) => (
              <Link key={p.slug} to={"/p/" + p.slug + query} className={s.card}>
                <div className={s.imagem}>
                  <ImagemCategoria categoria={p.categoria} />
                </div>
                <div className={s.info}>
                  <div className={s.categoria}>{p.categoria}</div>
                  <div className={s.nome}>{p.nome}</div>
                  <div className={s.preco}>{preco(p.precoCentavos)}</div>
                </div>
              </Link>
            ))}
          </main>
        </>
      ) : (
        <main className={s.vazio}>
          <h1>
            Ainda não chegamos aí.
            <br />
            Já já<span>.</span>
          </h1>
          <p>Por enquanto atendemos:</p>
          <div className={s.hubs}>
            {hubs.map(([hub, bairros]) => (
              <div key={hub}>
                <div className={s.hubNome}>{hub}</div>
                {bairros.map((b) => (
                  <button key={b} className={s.bairroLink} onClick={() => definir("bairro", b)}>
                    {b}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}
