import type { ReactNode } from 'react';

type StorefrontLayoutProps = {
  /** Cabeçalho da loja, injetado por quem conhece bairro/ETA/carrinho. */
  header?: ReactNode;
  /** Rodapé da loja. */
  footer?: ReactNode;
  children: ReactNode;
};

// Shell público: papel quente de ponta a ponta; o `<main>` fica a cargo de
// cada página. O shell só posiciona header, conteúdo (que ocupa o espaço
// restante) e footer.
export function StorefrontLayout({ header, footer, children }: StorefrontLayoutProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-paper text-ink">
      {header}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {footer}
    </div>
  );
}
