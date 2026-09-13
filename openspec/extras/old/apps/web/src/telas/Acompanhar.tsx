import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAcompanhamento } from "../estado/useAcompanhamento";
import s from "./Acompanhar.module.css";

type Pedido = {
  id: string;
  numero: string;
  endereco: string;
  andarSala: string | null;
  previsaoEntrega: string | null;
  itens: Array<{ produtoId: string; nome: string; precoCentavos: number; quantidade: number }>;
};

// Etapas fixas da tabela, com o evento que conclui cada uma.
// entrega.atribuida NÃO vira linha: aparece no rodapé (ver docs/design.md).
const ETAPAS = [
  { rotulo: "Pedido criado", evento: "pedido.criado" },
  { rotulo: "Pago", evento: "pagamento.aprovado" },
  { rotulo: "Confirmado", evento: "pedido.confirmado" },
  { rotulo: "Separado no hub", evento: "estoque.separado" },
  { rotulo: "A caminho", evento: "entrega.a_caminho" },
  { rotulo: "Chegando", evento: "entrega.chegando" },
  { rotulo: "Entregue", evento: "entrega.concluida" },
];

const horaDe = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour12: false });
const dois = (n: number) => String(n).padStart(2, "0");

export function Acompanhar() {
  const { id } = useParams();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const { eventos, vivos } = useAcompanhamento(id);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/pedidos/" + id).then(async (r) => {
      if (r.ok) setPedido(await r.json());
    });
  }, [id]);

  const porTipo = useMemo(() => {
    const mapa: Record<string, (typeof eventos)[number]> = {};
    for (const e of eventos) if (!mapa[e.tipo]) mapa[e.tipo] = e;
    return mapa;
  }, [eventos]);

  const entregue = !!porTipo["entrega.concluida"];

  useEffect(() => {
    if (entregue) return;
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [entregue]);

  useEffect(() => {
    if (pedido) document.title = "Pedido " + pedido.numero + " · já já.";
  }, [pedido]);

  const restanteMs = pedido?.previsaoEntrega ? new Date(pedido.previsaoEntrega).getTime() - agora : null;
  const contador = entregue
    ? "chegou"
    : restanteMs === null
      ? ""
      : restanteMs <= 0
        ? "já já…" // o evento de atraso vem no prompt 6
        : dois(Math.floor(restanteMs / 60000)) + ":" + dois(Math.floor((restanteMs % 60000) / 1000));

  const proxima = ETAPAS.findIndex((e) => !porTipo[e.evento]);
  const totalItens = pedido ? pedido.itens.reduce((soma, i) => soma + i.quantidade, 0) : 0;
  const atribuida = porTipo["entrega.atribuida"];
  const entrega = atribuida
    ? (atribuida.payload as { entregador: { nome: string; modal: string }; hub: string })
    : null;

  return (
    <div>
      <header className={s.topo}>
        <Link to="/" className={s.logo + (entregue ? " " + s.aceso : "")}>
          já já<span>.</span>
        </Link>
        <div className={s.chega} aria-live="polite">
          {!entregue && contador !== "" && contador !== "já já…" && <span className={s.chegaRotulo}>chega em</span>}
          <span className={s.contador}>{contador}</span>
        </div>
      </header>

      <div className={s.meta}>
        {pedido ? (
          <>
            pedido {pedido.numero} · {totalItens} {totalItens === 1 ? "item" : "itens"} · {pedido.endereco}
            {pedido.andarSala ? " · " + pedido.andarSala : ""}
          </>
        ) : (
          <span className={s.carregando}>pedido …</span>
        )}
      </div>

      <main className={s.coluna}>
        <div className={s.tabela}>
          {ETAPAS.map((etapa, indice) => {
            const evento = porTipo[etapa.evento];
            const emAndamento = !evento && indice === proxima && !entregue;
            const pendente = !evento && !emAndamento;
            return (
              <div
                key={etapa.evento}
                className={s.linha + (evento && vivos[evento.eventoId] ? " " + s.vivo : "")}
              >
                <span
                  className={
                    s.hora + (pendente ? " " + s.apagado : emAndamento ? " " + s.andamentoHora : "")
                  }
                >
                  {evento ? horaDe(evento.ocorridoEm) : emAndamento ? "agora" : "—"}
                </span>
                <span className={pendente ? s.apagado : undefined}>{etapa.rotulo}</span>
                <span>
                  {evento ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      role="img"
                      aria-label="concluída"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : emAndamento ? (
                    <span className={s.tag}>em andamento</span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>

        {entrega && atribuida && (
          <div className={s.rodape + (vivos[atribuida.eventoId] ? " " + s.vivo : "")}>
            {entrega.entregador.nome}, {entrega.entregador.modal === "bike" ? "de bike" : "a pé"} · saiu do{" "}
            {entrega.hub}
          </div>
        )}
      </main>
    </div>
  );
}
