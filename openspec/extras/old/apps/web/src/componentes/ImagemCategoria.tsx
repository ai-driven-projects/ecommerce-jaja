/* Imagens de produto: um SVG monocromático simples por categoria
   (tinta --ink sobre papel --surface), conforme docs/design.md. */

const TRACO = { fill: "none", stroke: "var(--ink)", strokeWidth: 3 } as const;

export function ImagemCategoria({ categoria }: { categoria: string }) {
  return (
    <svg viewBox="0 0 120 90" role="img" aria-label={categoria} width="100%">
      {desenho(categoria)}
    </svg>
  );
}

function desenho(categoria: string) {
  switch (categoria) {
    case "papelaria": // caderno
      return (
        <g {...TRACO}>
          <rect x="36" y="14" width="48" height="62" />
          <line x1="46" y1="30" x2="74" y2="30" />
          <line x1="46" y1="42" x2="74" y2="42" />
          <line x1="46" y1="54" x2="74" y2="54" />
        </g>
      );
    case "impressão": // folha saindo
      return (
        <g {...TRACO}>
          <rect x="30" y="34" width="60" height="28" />
          <rect x="44" y="14" width="32" height="20" />
          <line x1="38" y1="48" x2="52" y2="48" />
        </g>
      );
    case "café e lanches": // xícara
      return (
        <g {...TRACO}>
          <rect x="38" y="26" width="36" height="34" />
          <circle cx="82" cy="38" r="8" />
          <line x1="30" y1="70" x2="86" y2="70" />
        </g>
      );
    case "limpeza de escritório": // frasco
      return (
        <g {...TRACO}>
          <rect x="46" y="30" width="28" height="44" />
          <rect x="54" y="14" width="12" height="16" />
        </g>
      );
    default: // tecnologia básica: tela + cabo
      return (
        <g {...TRACO}>
          <rect x="32" y="18" width="56" height="38" />
          <line x1="60" y1="56" x2="60" y2="74" />
          <circle cx="60" cy="74" r="3" />
        </g>
      );
  }
}
