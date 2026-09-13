import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Barra } from "../componentes/Barra";
import { ImagemCategoria } from "../componentes/ImagemCategoria";
import { useSacola } from "../estado/useSacola";
import s from "./Produto.module.css";

type Detalhe = {
  slug: string;
  nome: string;
  categoria: string;
  precoCentavos: number;
  unidadeVenda: string;
  descricao: string;
  ficha: Array<[string, string]>;
  hub: string;
  estoque: number;
  relacionados: Array<{ slug: string; nome: string; categoria: string; precoCentavos: number }>;
};

const preco = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");

export function Produto() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const bairro = params.get("bairro") ?? "Aldeota";
  const categoria = params.get("categoria") ?? "todas";
  const [dados, setDados] = useState<Detalhe | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoExiste, setNaoExiste] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [naSacola, setNaSacola] = useState(false);
  const cronometro = useRef<number>();
  const { adicionar } = useSacola();

  const query = "?bairro=" + encodeURIComponent(bairro) + "&categoria=" + encodeURIComponent(categoria);

  useEffect(() => {
    setCarregando(true);
    setNaoExiste(false);
    (async () => {
      const r = await fetch("/api/catalogo/produtos/" + slug + "?bairro=" + encodeURIComponent(bairro));
      if (!r.ok) {
        setNaoExiste(true);
        setCarregando(false);
        return;
      }
      const detalhe: Detalhe = await r.json();
      setDados(detalhe);
      document.title = detalhe.nome + " · já já.";
      const re = await fetch("/api/catalogo/eta?bairro=" + encodeURIComponent(bairro));
      setEta(re.ok ? (await re.json()).etaMin : null);
      setCarregando(false);
    })();
  }, [slug, bairro]);

  useEffect(() => () => window.clearTimeout(cronometro.current), []);

  const trocarBairro = (b: string) =>
    setParams(
      (anterior) => {
        anterior.set("bairro", b);
        return anterior;
      },
      { replace: true }
    );

  const aoAdicionar = () => {
    if (!dados) return;
    adicionar(
      { produtoId: dados.slug, slug: dados.slug, nome: dados.nome, precoCentavos: dados.precoCentavos },
      quantidade
    );
    setNaSacola(true);
    window.clearTimeout(cronometro.current);
    cronometro.current = window.setTimeout(() => setNaSacola(false), 1500);
  };

  if (naoExiste)
    return (
      <div>
        <Barra bairro={bairro} aoTrocarBairro={trocarBairro} />
        <main className={s.naoAchamos}>
          <h1>Não achamos esse produto.</h1>
          <Link to={"/" + query}>voltar à vitrine</Link>
        </main>
      </div>
    );

  if (carregando || !dados)
    return (
      <div>
        <Barra bairro={bairro} aoTrocarBairro={trocarBairro} />
        <nav className={s.caminho}>
          <span className={s.carregandoTexto}>vitrine / … / …</span>
        </nav>
        <div className={s.duasColunas}>
          <div className={s.colunaImagem} />
          <div className={s.colunaInfo}>
            <div className={s.bloco}>
              <h1 className={s.nomeProduto + " " + s.carregandoTexto}>Nome do produto</h1>
            </div>
            <div className={s.bloco}>
              <span className={s.preco + " " + s.carregandoTexto}>R$ 00,00</span>
            </div>
            <div className={s.bloco}>
              <p className={s.disponibilidade + " " + s.carregandoTexto}>consultando o hub…</p>
            </div>
            <div className={s.bloco}>
              <p className={s.etaLinha + " " + s.carregandoTexto}>chega em — min</p>
            </div>
          </div>
        </div>
      </div>
    );

  const esgotado = dados.estoque === 0;
  const poucas = dados.estoque >= 1 && dados.estoque <= 3;
  const hubMinusculo = dados.hub.replace("Hub", "hub");

  return (
    <div>
      <Barra bairro={bairro} aoTrocarBairro={trocarBairro} />
      <nav className={s.caminho} aria-label="Caminho">
        <Link to={"/" + query}>vitrine</Link>
        <span>/</span>
        <Link to={"/?bairro=" + encodeURIComponent(bairro) + "&categoria=" + encodeURIComponent(dados.categoria)}>
          {dados.categoria}
        </Link>
        <span>/</span>
        <span className={s.caminhoAtual}>{dados.nome}</span>
      </nav>

      <div className={s.duasColunas}>
        <div className={s.colunaImagem} role="img" aria-label={dados.nome}>
          <ImagemCategoria categoria={dados.categoria} />
        </div>
        <div className={s.colunaInfo}>
          <div className={s.bloco}>
            <h1 className={s.nomeProduto}>{dados.nome}</h1>
            <Link
              className={s.linkCategoria}
              to={"/?bairro=" + encodeURIComponent(bairro) + "&categoria=" + encodeURIComponent(dados.categoria)}
            >
              {dados.categoria}
            </Link>
          </div>

          <div className={s.bloco}>
            <span className={s.preco}>{preco(dados.precoCentavos)}</span>
            <span className={s.unidade}>{dados.unidadeVenda}</span>
          </div>

          <div className={s.bloco}>
            <p className={s.disponibilidade}>
              {esgotado ? (
                <>Acabou no {hubMinusculo}. Já já repõe.</>
              ) : poucas ? (
                <>
                  {dados.estoque === 1 ? "Última " : "Últimas "}
                  <b>{dados.estoque}</b> no {hubMinusculo}.
                </>
              ) : (
                <>Tem no {hubMinusculo}.</>
              )}
            </p>
          </div>

          <div className={s.bloco}>
            {eta !== null && <p className={s.etaLinha}>chega em {eta} min</p>}
            <div className={s.acao}>
              {!esgotado && (
                <div className={s.quantidade}>
                  <button aria-label="Diminuir quantidade" onClick={() => setQuantidade(Math.max(1, quantidade - 1))}>
                    −
                  </button>
                  <span aria-live="polite">{quantidade}</span>
                  <button aria-label="Aumentar quantidade" onClick={() => setQuantidade(quantidade + 1)}>
                    +
                  </button>
                </div>
              )}
              <button className={s.adicionar} onClick={esgotado ? undefined : aoAdicionar}>
                {esgotado ? "Avisar quando voltar" : naSacola ? "Na sacola" : "Adicionar à sacola"}
              </button>
            </div>
          </div>

          <div className={s.bloco}>
            <p className={s.descricao}>{dados.descricao}</p>
            <div className={s.ficha}>
              {dados.ficha.map(([chave, valor]) => (
                <div key={chave} className={s.linhaFicha}>
                  <span className={s.chave}>{chave}</span>
                  <span>{valor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {dados.relacionados.length > 0 && (
        <section className={s.vaiJunto}>
          <div className={s.tituloVaiJunto}>vai junto</div>
          <div className={s.relacionados}>
            {dados.relacionados.map((r) => (
              <Link key={r.slug} to={"/p/" + r.slug + query} className={s.relacionado}>
                <div className={s.imagemRelacionado}>
                  <ImagemCategoria categoria={r.categoria} />
                </div>
                <div>
                  <div className={s.nomeRelacionado}>{r.nome}</div>
                  <div className={s.precoRelacionado}>{preco(r.precoCentavos)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
