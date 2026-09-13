import { cn } from '@/shared/lib/class-name.util';

// Área de imagem do produto: emoji grande sobre um tom pastel por categoria.
// Sem fotos, sem marcas.

const TINT_BY_CATEGORY: Record<string, string> = {
  papelaria: 'bg-tint-yellow',
  impressão: 'bg-tint-blue',
  'café e lanches': 'bg-tint-peach',
  'limpeza de escritório': 'bg-tint-mint',
  'tecnologia básica': 'bg-tint-purple',
};

const EMOJI_BY_CATEGORY: Record<string, string> = {
  papelaria: '✏️',
  impressão: '🖨️',
  'café e lanches': '☕',
  'limpeza de escritório': '🧽',
  'tecnologia básica': '💻',
};

export function categoryTintClass(category: string): string {
  return TINT_BY_CATEGORY[category] ?? 'bg-tint-green';
}

export function categoryEmoji(category: string): string {
  return EMOJI_BY_CATEGORY[category] ?? '🗂️';
}

type ProductArtProps = {
  emoji: string;
  category: string;
  /** Tamanho do emoji e raio da área. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  children?: React.ReactNode;
};

const sizeClasses: Record<NonNullable<ProductArtProps['size']>, string> = {
  xs: 'size-[38px] rounded-[10px] text-[19px]',
  sm: 'size-[52px] rounded-xl text-[26px]',
  md: 'h-[120px] w-full rounded-xl text-[46px]',
  lg: 'h-[130px] w-full rounded-xl text-[50px]',
  xl: 'h-[380px] w-full rounded-4xl text-[120px]',
};

export function ProductArt({ emoji, category, size = 'md', className, children }: ProductArtProps) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center leading-none',
        categoryTintClass(category),
        sizeClasses[size],
        className,
      )}
      aria-hidden="true"
    >
      {emoji}
      {children}
    </span>
  );
}
