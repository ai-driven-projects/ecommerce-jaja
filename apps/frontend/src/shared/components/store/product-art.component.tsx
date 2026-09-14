'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { categoryEmoji, categoryTintClass } from '@/shared/components/store/category-art';
import { cn } from '@/shared/lib/class-name.util';

// Área de imagem do produto: a foto inteira (`object-contain`) sobre branco,
// com respiro interno. Sem foto, ou quando ela não carrega, o emoji grande
// sobre o tom pastel da categoria raiz.

type ProductArtSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type ProductArtProps = {
  /** Emoji de reserva; sem ele, vale o da categoria. */
  emoji?: string;
  /** Slug da categoria raiz (ou chave do catálogo local): tom e emoji de reserva. */
  category: string;
  /** Foto do produto. */
  imageUrl?: string | null;
  /** Texto alternativo da foto (o nome do produto). */
  alt?: string;
  /** Tamanho do emoji e raio da área. */
  size?: ProductArtSize;
  /** `sizes` do `next/image`; o padrão acompanha o tamanho. */
  sizes?: string;
  /** Carrega a foto de imediato, com prioridade alta (imagem principal acima da dobra). */
  eager?: boolean;
  className?: string;
  children?: ReactNode;
};

const sizeClasses: Record<ProductArtSize, string> = {
  xs: 'size-[38px] rounded-[10px] text-[19px]',
  sm: 'size-[52px] rounded-xl text-[26px]',
  md: 'h-[120px] w-full rounded-xl text-[46px]',
  lg: 'h-[130px] w-full rounded-xl text-[50px]',
  xl: 'h-[380px] w-full rounded-4xl text-[120px]',
};

const imageSizes: Record<ProductArtSize, string> = {
  xs: '40px',
  sm: '52px',
  md: '(max-width: 640px) 50vw, 240px',
  lg: '(max-width: 640px) 100vw, 300px',
  xl: '(max-width: 1024px) 100vw, 640px',
};

const imageInsets: Record<ProductArtSize, string> = {
  xs: 'inset-0.5',
  sm: 'inset-1',
  md: 'inset-2',
  lg: 'inset-2.5',
  xl: 'inset-6 sm:inset-10',
};

export function ProductArt({
  emoji,
  category,
  imageUrl,
  alt = '',
  size = 'md',
  sizes,
  eager = false,
  className,
  children,
}: ProductArtProps) {
  // URL que falhou: outra URL (troca de imagem) volta a tentar a foto.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photo = imageUrl && imageUrl !== failedUrl ? imageUrl : null;

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden leading-none',
        photo ? 'bg-card' : categoryTintClass(category),
        sizeClasses[size],
        className,
      )}
      aria-hidden={photo ? undefined : true}
    >
      {photo ? (
        <span className={cn('absolute', imageInsets[size])}>
          <Image
            src={photo}
            alt={alt}
            fill
            sizes={sizes ?? imageSizes[size]}
            loading={eager ? 'eager' : undefined}
            fetchPriority={eager ? 'high' : undefined}
            className="object-contain"
            onError={() => setFailedUrl(photo)}
          />
        </span>
      ) : (
        (emoji ?? categoryEmoji(category))
      )}
      {children}
    </span>
  );
}
