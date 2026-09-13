import { cn } from '@/shared/lib/class-name.util';

// ── Logo "já já" ──────────────────────────────────────────────────────────────
// Bloco laranja arredondado com a bike em traço branco + wordmark em Bricolage
// Grotesque 800. Sem imagem: o logo é SVG inline e nunca depende de `public/`.

type LogoSize = 'sm' | 'md' | 'lg';
type LogoTone = 'ink' | 'light';

const markSizeClasses: Record<LogoSize, string> = {
  sm: 'size-8 rounded-[11px] [&_svg]:size-[19px]',
  md: 'size-[38px] rounded-[13px] [&_svg]:size-[22px]',
  lg: 'size-10 rounded-[14px] [&_svg]:size-6',
};

const textSizeClasses: Record<LogoSize, string> = {
  sm: 'text-lg',
  md: 'text-[19px]',
  lg: 'text-[26px]',
};

const gapClasses: Record<LogoSize, string> = {
  sm: 'gap-2',
  md: 'gap-2.5',
  lg: 'gap-2.5',
};

const toneClasses: Record<LogoTone, string> = {
  ink: 'text-ink',
  light: 'text-white',
};

/** A bike do logo, também usada solta em selos de entrega (herda `currentColor`). */
export function BikeIcon({ className, strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="6" cy="16.5" r="3.4" />
      <circle cx="18" cy="16.5" r="3.4" />
      <path d="M6 16.5 L10 9 L15 9" />
      <path d="M12 16.5 L15 9 L14 6.5 H16.5" />
      <path d="M12 16.5 H6" />
    </svg>
  );
}

type AppLogoMarkProps = {
  size?: LogoSize;
  className?: string;
  /** Mantido por compatibilidade de API: não há imagem para priorizar. */
  priority?: boolean;
};

type AppWordmarkProps = {
  size?: LogoSize;
  tone?: LogoTone;
  className?: string;
};

type AppLogoProps = {
  size?: LogoSize;
  tone?: LogoTone;
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showMark?: boolean;
  showText?: boolean;
  withText?: boolean;
  /** Mantido por compatibilidade de API: não há imagem para priorizar. */
  priority?: boolean;
};

/** O bloco laranja com a bike. */
export function AppLogoMark({ size = 'md', className }: AppLogoMarkProps) {
  return (
    <span
      role="img"
      aria-label="já já"
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-brand text-white',
        markSizeClasses[size],
        className,
      )}
    >
      <BikeIcon />
    </span>
  );
}

/** Wordmark "já já" em Bricolage Grotesque 800. */
export function AppWordmark({ size = 'md', tone = 'ink', className }: AppWordmarkProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap font-display font-extrabold leading-none tracking-[-0.5px]',
        textSizeClasses[size],
        toneClasses[tone],
        className,
      )}
    >
      já já
    </span>
  );
}

export function AppLogo({
  size = 'md',
  tone = 'ink',
  className,
  markClassName,
  textClassName,
  showMark = true,
  showText,
  withText = true,
}: AppLogoProps) {
  const shouldShowText = showText ?? withText;

  return (
    <span className={cn('inline-flex items-center', gapClasses[size], className)}>
      {showMark ? <AppLogoMark size={size} className={markClassName} /> : null}
      {shouldShowText ? <AppWordmark size={size} tone={tone} className={textClassName} /> : null}
    </span>
  );
}
