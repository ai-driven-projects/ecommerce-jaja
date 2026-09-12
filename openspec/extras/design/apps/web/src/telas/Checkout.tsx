import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Barra, NAO_ATENDIDOS } from "../componentes/Barra";
import { useSacola } from "../estado/useSacola";
import s from "./Checkout.module.css";

type Zona = { bairro: string; hub: string };

const preco = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");

export function Checkout() {
  const [params, setParams] = useSearchParams();
  const bairroInicial = params.get("bairro") ?? "Aldeota";
  const navegar = useNavigate();
  const { itens, total, esvaziar } = useSacola();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [bairro, setBairro] = useState(bairroInicial);
  const [endereco, setEndereco] = useState("");
  const [andarSala, setAndarSala] = useState("");
  const [recebedor, setRecebedor] = useState("");
  const [erros, setErros] = useState<{ endereco?: string; recebedor?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const [naoAtendido, setNaoAtendido] = useState(false);

  useEffect(() => {
    document.title = "fechar pedido · já já.";
    fetch("/api/catalogo/zonas").then((r) => r.json()).then(setZonas);
  }, []);

  const trocarBairro = (b: string) => {
    setBairro(b);
    setNaoAtendido(false);
    setParams(
      (anterior) => {
        anterior.set("bairro", b);
        return anterior;
      },
      { replace: true }
    );
  };

  const pedir = async () => {
    const novosErros: typeof erros = {};
    if (!endereco.trim()) novosErros.endereco = "Precisamos da rua e do número.";
    if (!recebedor.trim()) novosErros.recebedor = "Quem recebe aí?";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setEnviando(true);
    const res = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bairro,
        endereco: endereco.trim(),
        andarSala: andarSala.trim(),
        recebedor: recebedor.trim(),
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
      }),
    });
    if (res.status === 409) {
      setNaoAtendido(true);
      setEnviando(false);
      return;
    }
    if (!res.ok) {
      setEnviando(false);
      return;
    }
    const { pedidoId } = await res.json();
    esvaziar();
    navegar("/pedidos/" + pedidoId + "/acompanhar");
  };

  return (
    <div>
      <Barra bairro={bairro} aoTrocarBairro={trocarBairro} />
      <main className={s.coluna}>
        <h1 className={s.tituloPagina}>Fechar pedido</h1>

        {itens.length === 0 ? (
          <p className={s.vazia}>
            Sua sacola está vazia. Já já enche. <Link to={"/" + "?" + params.toString()}>voltar à vitrine</Link>
          </p>
        ) : naoAtendido ? (
          <div className={s.naoAtendido}>
            <h1>Ainda não chegamos aí.</h1>
            <p>Por enquanto atendemos:</p>
            <ul>
              {zonas.map((z) => (
                <li key={z.bairro}>{z.bairro}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <section className={s.secao}>
              <div className={s.tituloSecao}>entrega</div>
              <div className={s.campo}>
                <label htmlFor="bairro">bairro</label>
                <select id="bairro" value={bairro} onChange={(e) => trocarBairro(e.target.value)}>
                  {[...zonas.map((z) => z.bairro), ...NAO_ATENDIDOS].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className={s.campo}>
                <label htmlFor="endereco">rua e número</label>
                <input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
                {erros.endereco && <span className={s.erro}>{erros.endereco}</span>}
              </div>
              <div className={s.campo}>
                <label htmlFor="andarSala">andar / sala</label>
                <input id="andarSala" value={andarSala} onChange={(e) => setAndarSala(e.target.value)} />
              </div>
              <div className={s.campo}>
                <label htmlFor="recebedor">quem recebe</label>
                <input id="recebedor" value={recebedor} onChange={(e) => setRecebedor(e.target.value)} />
                {erros.recebedor && <span className={s.erro}>{erros.recebedor}</span>}
              </div>
            </section>

            <section className={s.secao}>
              <div className={s.tituloSecao}>pagamento</div>
              <p className={s.pix}>PIX</p>
            </section>

            <section className={s.secao}>
              <div className={s.tituloSecao}>resumo</div>
              {itens.map((i) => (
                <div key={i.produtoId} className={s.linhaResumo}>
                  <span>
                    {i.quantidade}× {i.nome}
                  </span>
                  <span>{preco(i.precoCentavos * i.quantidade)}</span>
                </div>
              ))}
              <div className={s.linhaResumo + " " + s.linhaTotal}>
                <span>total</span>
                <span>{preco(total)}</span>
              </div>
            </section>

            <button className={s.pedir} onClick={pedir} disabled={enviando}>
              {enviando ? "enviando…" : "Pedir"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
