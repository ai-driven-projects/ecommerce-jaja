import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/class-name.util';

// Botões em pílula. O primário é laranja com brilho suave; os demais são
// brancos/creme com borda de 1px. Transições só em hover/estado (≤150ms).
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-extrabold transition-[background-color,color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-white shadow-brand hover:bg-brand-strong',
        secondary: 'border border-line bg-surface text-ink hover:bg-surface-strong',
        outline: 'border border-line bg-card text-ink hover:bg-surface',
        ghost: 'bg-transparent text-ink hover:bg-surface',
        dark: 'bg-dark text-white hover:bg-black',
        success: 'bg-success text-white hover:bg-success-strong',
        danger: 'bg-danger text-white hover:bg-[#b02f27]',
        soft: 'bg-brand-soft text-brand hover:bg-brand-pale',
        link: 'h-auto rounded-none px-0 text-brand hover:text-brand-link',
      },
      size: {
        default: 'h-10 px-[18px]',
        sm: 'h-9 px-4 text-[13px]',
        lg: 'h-12 px-6 text-[15px]',
        xl: 'h-[52px] px-7 text-[15.5px]',
        icon: 'size-10 rounded-full p-0',
        'icon-sm': 'size-[34px] rounded-full p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
