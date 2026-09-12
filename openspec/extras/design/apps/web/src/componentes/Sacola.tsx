import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSacola } from "../estado/useSacola";
import s from "./Sacola.module.css";

const preco = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");

export function Sacola({ fechar, eta }: { fechar: () => void; eta: number | null }) {
  const { itens, total, alterarQuantidade } = useSacola();
  const navegar = useNavigate();
  const local = useLocation();
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    painel.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [fechar]);

  return (
    <>
      <div className={s.fundo} onClick={fechar} />
      <div ref={painel} tabIndex={-1} role="dialog" aria-label="Sacola" className={s.painel}>
        <div className={s.cabecalho}>
          <span className={s.titulo}>sacola</span>
          <button className={s.fecharBotao} onClick={fechar} aria-label="Fechar sacola">
            ×
          </button>
        </div>

        {itens.length === 0 ? (
          <p className={s.vazia}>Sua sacola está vazia. Já já enche.</p>
        ) : (
          <div className={s.itens}>
            {itens.map((i) => (
              <div key={i.produtoId} className={s.item}>
                <span className={s.nomeItem}>{i.nome}</span>
                <div className={s.quantidade}>
                  <button
                    aria-label={"Diminuir quantidade de " + i.nome}
                    onClick={() => alterarQuantidade(i.produtoId, i.quantidade - 1)}
                  >
                    −
                  </button>
                  <span aria-live="polite">{i.quantidade}</span>
                  <button
                    aria-label={"Aumentar quantidade de " + i.nome}
                    onClick={() => alterarQuantidade(i.produtoId, i.quantidade + 1)}
                  >
                    +
                  </button>
                </div>
                <span className={s.precoItem}>{preco(i.precoCentavos * i.quantidade)}</span>
              </div>
            ))}
          </div>
        )}

        {itens.length > 0 && (
          <div className={s.rodape}>
            <div className={s.totalLinha}>
              <span className={s.totalRotulo}>total</span>
              <span className={s.totalValor}>{preco(total)}</span>
            </div>
            {eta !== null && <span className={s.etaLinha}>chega em {eta} min</span>}
            <button
              className={s.fecharPedido}
              onClick={() => {
                fechar();
                navegar("/checkout" + local.search);
              }}
            >
              Fechar pedido
            </button>
          </div>
        )}
      </div>
    </>
  );
}
