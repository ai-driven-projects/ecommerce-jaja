type EmptyListStateProps = {
  title: string;
  subtitle: string;
  /** Emoji ilustrativo no topo (padrão: caixa). */
  emoji?: string;
  /** Mantido por compatibilidade: o design não usa fotos. */
  imageAlt?: string;
};

/** Estado vazio de lista: emoji grande, título em display e explicação curta. */
export function EmptyListState({ title, subtitle, emoji = '📦' }: EmptyListStateProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-card px-6 py-12 text-center">
      <span className="text-[40px] leading-none" aria-hidden="true">
        {emoji}
      </span>
      <h3 className="mt-2 font-display text-xl font-extrabold tracking-[-0.3px]">{title}</h3>
      <p className="max-w-md text-sm text-muted-ink">{subtitle}</p>
    </div>
  );
}
