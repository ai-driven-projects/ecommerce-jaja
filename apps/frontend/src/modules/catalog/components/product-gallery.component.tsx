'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { cn } from '@/shared/lib/class-name.util';
import type { StorefrontProductImage } from '../data/storefront.api';

type ProductGalleryProps = {
  /** Imagens na ordem da API; a primeira é a principal. */
  images: StorefrontProductImage[];
  /** Nome do produto: texto alternativo das fotos. */
  name: string;
  /** Slug da categoria raiz: ilustração de reserva. */
  category: string;
};

/**
 * Galeria do detalhe: imagem principal quadrada (`largeUrl`); com mais de uma
 * imagem, setas anterior/próxima, contador "n/total" e miniaturas de 72px
 * roláveis (`role="tablist"`, setas do teclado, Home e End). Com uma imagem,
 * só a principal; sem imagens, a ilustração da categoria.
 */
export function ProductGallery({ images, name, category }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const panelId = useId();

  const count = images.length;
  const current = images[active] ?? null;
  const hasControls = count > 1;

  // Seleciona a imagem e rola só a faixa de miniaturas (sem mexer na rolagem da página).
  const select = (index: number, focus = false) => {
    const next = (index + count) % count;
    setActive(next);

    const strip = stripRef.current;
    const thumb = thumbRefs.current[next];
    if (!strip || !thumb) return;

    strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2 });
    if (focus) thumb.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const targets: Record<string, number> = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: count - 1 };
    const target = targets[event.key];
    if (target === undefined) return;

    event.preventDefault();
    select(target, true);
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div
        id={panelId}
        role={hasControls ? 'tabpanel' : undefined}
        aria-label={hasControls ? `Imagem ${active + 1} de ${count}` : undefined}
        className="relative"
      >
        <ProductArt
          category={category}
          imageUrl={current?.largeUrl}
          alt={name}
          size="xl"
          sizes="(max-width: 1024px) 100vw, 620px"
          eager={active === 0}
          className="aspect-square h-auto border border-line"
        />

        {hasControls ? (
          <>
            <button
              type="button"
              aria-label="Imagem anterior"
              aria-controls={panelId}
              disabled={active === 0}
              onClick={() => select(active - 1)}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card text-ink shadow-badge transition-colors duration-150 hover:text-brand disabled:opacity-40"
            >
              <ChevronLeft className="size-5" strokeWidth={2.4} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Próxima imagem"
              aria-controls={panelId}
              disabled={active === count - 1}
              onClick={() => select(active + 1)}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card text-ink shadow-badge transition-colors duration-150 hover:text-brand disabled:opacity-40"
            >
              <ChevronRight className="size-5" strokeWidth={2.4} aria-hidden="true" />
            </button>
            <span
              aria-live="polite"
              className="absolute bottom-4 right-4 rounded-pill bg-card px-3 py-1 text-xs font-extrabold tabular-nums text-ink shadow-badge"
            >
              {active + 1}/{count}
            </span>
          </>
        ) : null}
      </div>

      {hasControls ? (
        <div
          ref={stripRef}
          role="tablist"
          aria-label="Imagens do produto"
          onKeyDown={handleKeyDown}
          className="relative flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          {images.map((image, index) => {
            const selected = index === active;

            return (
              <button
                key={`${image.order}-${image.thumbUrl}`}
                ref={(element) => {
                  thumbRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                aria-label={`Imagem ${index + 1} de ${count}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(index)}
                className={cn(
                  'size-[72px] shrink-0 rounded-xl border-2 p-1 transition-colors duration-150',
                  selected ? 'border-brand bg-card' : 'border-transparent bg-surface hover:border-line',
                )}
              >
                <ProductArt
                  category={category}
                  imageUrl={image.thumbUrl}
                  size="sm"
                  sizes="72px"
                  className="size-full rounded-lg text-[26px]"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
