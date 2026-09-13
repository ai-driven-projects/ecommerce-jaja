import Link from 'next/link';
import { BikeIcon } from '@/shared/components/branding/app-logo.component';

type StorefrontHeroProps = {
  neighborhood: string;
  couriersOnline: number;
  /** Destino do botão "Pedir agora" (âncora da primeira seção). */
  ctaHref: string;
};

const LIVE_CARDS = [
  { emoji: '📦', tint: 'bg-tint-peach', title: 'Pedido #4207 saiu', detail: 'Hub Aldeota → Av. Santos Dumont', badge: '8 min' },
  { emoji: '🖨️', tint: 'bg-tint-blue', title: 'Toner entregue', detail: 'Ed. Torre Sul · 9º andar', badge: '✓ 19 min' },
] as const;

/** Bloco escuro de abertura da vitrine: promessa, CTA e dois "pedidos ao vivo". */
export function StorefrontHero({ neighborhood, couriersOnline, ctaHref }: StorefrontHeroProps) {
  return (
    <section className="relative flex flex-wrap items-center gap-8 overflow-hidden rounded-4xl bg-dark px-6 py-8 sm:px-11 sm:py-10">
      <div className="min-w-[260px] flex-1">
        <span className="mb-4 inline-flex items-center gap-2 rounded-pill border border-white/20 bg-white/10 px-3.5 py-1.5 text-[13px] font-bold text-brand-pale">
          <BikeIcon className="size-[15px]" strokeWidth={2} />
          De bike e a pé por {neighborhood}
        </span>
        <h1 className="mb-3 font-display text-[32px] font-extrabold leading-[1.1] tracking-[-1px] text-white sm:text-[40px]">
          Acabou no escritório?
          <br />
          Chega <span className="text-brand-light">em minutos.</span>
        </h1>
        <p className="mb-[22px] max-w-[440px] text-base leading-[1.55] text-dark-muted">
          Papel, toner, café e tudo que o seu escritório consome — entregue por bike direto na sua recepção, sem taxa
          surpresa.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={ctaHref}
            className="inline-block rounded-pill bg-brand px-[26px] py-[13px] text-[15px] font-extrabold text-white transition-colors duration-150 hover:bg-brand-strong"
          >
            Pedir agora
          </Link>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-success-light">
            <span className="size-2 rounded-full bg-success animate-pulse-soft" aria-hidden="true" />
            {couriersOnline} entregadores online agora
          </span>
        </div>
      </div>

      <div className="flex w-[300px] max-w-full flex-col gap-3" aria-hidden="true">
        {LIVE_CARDS.map((card) => (
          <div key={card.title} className="flex items-center gap-3 rounded-2xl bg-card px-[18px] py-4 shadow-deep">
            <span className={`flex size-[42px] items-center justify-center rounded-xl text-[22px] ${card.tint}`}>{card.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold">{card.title}</div>
              <div className="truncate text-[12.5px] text-muted-ink">{card.detail}</div>
            </div>
            <span className="shrink-0 rounded-pill bg-success-soft px-2.5 py-1 text-xs font-extrabold text-success">{card.badge}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
