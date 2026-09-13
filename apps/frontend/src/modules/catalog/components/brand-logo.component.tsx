'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/class-name.util';

type BrandLogoSize = 'sm' | 'lg';

type BrandLogoProps = {
  url: string | null | undefined;
  name: string;
  size?: BrandLogoSize;
  className?: string;
};

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: 'size-10 rounded-[10px] p-1',
  lg: 'size-24 rounded-[14px] p-2',
};

/**
 * Miniatura do logo da marca em um quadrado de borda suave. Sem URL, ou quando
 * a imagem não carrega, mostra o placeholder quadrado em `bg-surface`.
 */
export function BrandLogo({ url, name, size = 'sm', className }: BrandLogoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(url) && failedUrl !== url;

  if (!showImage || !url) {
    return <span aria-hidden="true" className={cn('block shrink-0 bg-surface', sizeClasses[size], className)} />;
  }

  return (
    <span className={cn('flex shrink-0 items-center justify-center border border-line bg-card', sizeClasses[size], className)}>
      {/* Logos vêm de URLs externas arbitrárias informadas no cadastro, fora do otimizador de imagens. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Logo da marca ${name}`}
        loading="lazy"
        className="size-full object-contain"
        onError={() => setFailedUrl(url)}
      />
    </span>
  );
}
