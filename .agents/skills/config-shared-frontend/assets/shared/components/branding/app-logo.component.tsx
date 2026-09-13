import Image from 'next/image';
import { cn } from '@/shared/lib/class-name.util';

// ── Configuração ──────────────────────────────────────────────────────────────
// Substitua APP_NAME pelo nome do seu app e defina o mark visual abaixo.
const APP_NAME = 'App';

type LogoSize = 'sm' | 'md' | 'lg';

const markSizeClasses: Record<LogoSize, string> = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-11',
};

const textSizeClasses: Record<LogoSize, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
};

const gapClasses: Record<LogoSize, string> = {
  sm: 'gap-2',
  md: 'gap-2.5',
  lg: 'gap-3',
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

type AppLogoMarkProps = {
  size?: LogoSize;
  className?: string;
  priority?: boolean;
};

type AppWordmarkProps = {
  size?: LogoSize;
  className?: string;
};

type AppLogoProps = {
  size?: LogoSize;
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showMark?: boolean;
  showText?: boolean;
  withText?: boolean;
  priority?: boolean;
};

// ── Componentes ───────────────────────────────────────────────────────────────

export function AppLogoMark({ size = 'md', className, priority = false }: AppLogoMarkProps) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl',
        markSizeClasses[size],
        className,
      )}
    >
      <Image
        src="/logo.webp"
        alt={`${APP_NAME} logo`}
        fill
        className="object-contain"
        sizes="44px"
        priority={priority}
      />
    </span>
  );
}

export function AppWordmark({ size = 'md', className }: AppWordmarkProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-black leading-none normal-case tracking-normal',
        textSizeClasses[size],
        className,
      )}
    >
      {APP_NAME}
    </span>
  );
}

export function AppLogo({
  size = 'md',
  className,
  markClassName,
  textClassName,
  showMark = true,
  showText,
  withText = true,
  priority = false,
}: AppLogoProps) {
  const shouldShowText = showText ?? withText;

  return (
    <span className={cn('inline-flex items-center', gapClasses[size], className)}>
      {showMark ? <AppLogoMark size={size} className={markClassName} priority={priority} /> : null}
      {shouldShowText ? <AppWordmark size={size} className={textClassName} /> : null}
    </span>
  );
}
