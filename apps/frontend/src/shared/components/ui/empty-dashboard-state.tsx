type EmptyDashboardStateProps = {
  moduleName?: string;
  /** Emoji ilustrativo (padrão: gráfico). */
  emoji?: string;
  description?: string;
};

/** Placeholder de módulo do admin ainda sem widgets. */
export function EmptyDashboardState({
  moduleName,
  emoji = '📊',
  description = 'Esta área está pronta para receber os widgets e indicadores do módulo. Já já chega.',
}: EmptyDashboardStateProps) {
  const normalizedModuleName = moduleName?.trim();

  return (
    <section className="flex w-full flex-col items-center rounded-2xl border border-dashed border-line bg-card px-6 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-[30px]" aria-hidden="true">
        {emoji}
      </span>
      <h2 className="mt-4 font-display text-2xl font-extrabold tracking-[-0.5px]">
        {normalizedModuleName || 'Em breve'}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-ink">{description}</p>
    </section>
  );
}
