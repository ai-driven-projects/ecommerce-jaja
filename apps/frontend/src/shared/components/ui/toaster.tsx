'use client';

import { Toaster as Sonner } from 'sonner';

// Toasts como cartões brancos: borda suave, raio 16 e sombra flutuante.
// `richColors` fica desligado: laranja é ação, verde é sucesso, vermelho é erro.
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'font-sans! bg-card! text-ink! border! border-line! [border-radius:16px]! [box-shadow:var(--shadow-float)]! [&_[data-icon]]:text-brand',
          title: 'font-bold! text-ink!',
          description: 'text-muted-ink!',
          actionButton: 'bg-brand! text-white! [border-radius:999px]! font-extrabold!',
          cancelButton: 'bg-surface! text-ink! [border-radius:999px]! font-bold!',
          success: '[&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:text-danger',
        },
      }}
    />
  );
}
