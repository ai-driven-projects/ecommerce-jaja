'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/class-name.util';

type ProductThumbnailSize = 'sm' | 'lg';

type ProductThumbnailProps = {
  url: string | null | undefined;
  name: string;
  size?: ProductThumbnailSize;
  className?: string;
};

const sizeClasses: Record<ProductThumbnailSize, string> = {
  sm: 'size-12 rounded-[10px] p-1',
  lg: 'size-24 rounded-[14px] p-2',
};

const placeholderEmojiClasses: Record<ProductThumbnailSize, string> = {
  sm: 'text-lg',
  lg: 'text-3xl',
};

/**
 * Miniatura do produto em um quadrado de borda suave. Sem URL, ou quando a
 * imagem não carrega, mostra o placeholder em `bg-surface` com o emoji de caixa.
 */
export function ProductThumbnail({ url, name, size = 'sm', className }: ProductThumbnailProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!url || failedUrl === url) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center bg-surface leading-none',
          sizeClasses[size],
          placeholderEmojiClasses[size],
          className,
        )}
      >
        📦
      </span>
    );
  }

  return (
    <span className={cn('flex shrink-0 items-center justify-center border border-line bg-card', sizeClasses[size], className)}>
      {/* Imagens vêm de URLs externas arbitrárias informadas no cadastro, fora do otimizador de imagens. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Imagem do produto ${name}`}
        loading="lazy"
        className="size-full object-contain"
        onError={() => setFailedUrl(url)}
      />
    </span>
  );
}
