import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/class-name.util';

// Etiquetas em pílula: fundo pastel + texto na cor do estado.
const badgeVariants = cva('inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1 text-xs font-extrabold', {
  variants: {
    variant: {
      default: 'bg-surface text-ink',
      muted: 'bg-surface text-muted-ink',
      brand: 'bg-brand-soft text-brand',
      solid: 'bg-brand text-white',
      success: 'bg-success-soft text-success',
      warning: 'bg-warning-soft text-warning',
      danger: 'bg-danger-soft text-danger',
      outline: 'border border-line bg-card text-ink',
      dark: 'bg-dark text-white',
      /** Mantido por compatibilidade com telas antigas (`variant="secondary"`). */
      secondary: 'bg-surface text-ink',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
