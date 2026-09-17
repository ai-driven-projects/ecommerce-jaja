import Link from 'next/link';
import { AppWordmark } from '@/shared/components/branding/app-logo.component';
import { Badge } from '@/shared/components/ui/badge';

type StorefrontFooterProps = {
  /** Nomes das lojas ativas, exibidos como pílulas. */
  stores?: string[];
  adminHref?: string;
};

// Rodapé branco com régua superior de 1px: wordmark + horário, as lojas
// ativas em pílulas e o link discreto para a área administrativa.
export function StorefrontFooter({ stores = [], adminHref = '/admin' }: StorefrontFooterProps) {
  return (
    <footer className="mt-auto border-t border-line bg-card">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-4 py-7 sm:px-6">
        <div>
          <AppWordmark size="md" className="text-xl" />
          <p className="mt-1 text-[13px] text-muted-ink">Entrega rápida para escritórios · seg–sex, 8h–19h</p>
        </div>

        {stores.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[13px] font-bold text-muted-ink">Nossas lojas:</span>
            {stores.map((store) => (
              <Badge key={store} variant="default" className="px-[13px] py-1.5 text-[12.5px] font-bold">
                {store}
              </Badge>
            ))}
          </div>
        ) : null}

        <Link href={adminHref} className="text-[13px] text-muted-ink transition-colors duration-150 hover:text-brand">
          Área administrativa
        </Link>
      </div>
    </footer>
  );
}
