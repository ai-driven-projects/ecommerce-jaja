import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSacola } from "../estado/useSacola";
import s from "./Barra.module.css";
import { Sacola } from "./Sacola";

type Zona = { bairro: string; hub: string };

export const NAO_ATENDIDOS = ["Papicu", "Montese", "Messejana"];

export function Barra({
  bairro,
  aoTrocarBairro,
}: {
  bairro: string;
  aoTrocarBairro: (bairro: string) => void;
}) {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [eta, setEta] = useState<number | null>(null);
  const [aberta, setAberta] = useState(false);
  const botaoSacola = useRef<HTMLButtonElement>(null);
  const { quantidadeTotal } = useSacola();

  useEffect(() => {
    fetch("/api/catalogo/zonas").then((r) => r.json()).then(setZonas);
  }, []);

  useEffect(() => {
    fetch("/api/catalogo/eta?bairro=" + encodeURIComponent(bairro)).then(async (r) => {
      setEta(r.ok ? (await r.json()).etaMin : null);
    });
  }, [bairro]);

  const fechar = () => {
    setAberta(false);
    botaoSacola.current?.focus();
  };

  return (
    <header className={s.topo}>
      <Link to="/" className={s.logo}>
        já já<span>.</span>
      </Link>
      <select
        className={s.seletor}
        value={bairro}
        onChange={(e) => aoTrocarBairro(e.target.value)}
        aria-label="Bairro de entrega"
      >
        {[...zonas.map((z) => z.bairro), ...NAO_ATENDIDOS].map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      {eta !== null && (
        <div className={s.eta}>
          chega em <b>{eta} min</b>
        </div>
      )}
      <button
        ref={botaoSacola}
        className={s.sacola}
        aria-label={"Abrir sacola, " + quantidadeTotal + " itens"}
        onClick={() => setAberta(true)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        <span className={s.contador}>{quantidadeTotal}</span>
      </button>
      {aberta && <Sacola fechar={fechar} eta={eta} />}
    </header>
  );
}
