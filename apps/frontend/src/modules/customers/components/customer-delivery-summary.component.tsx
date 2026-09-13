'use client';

import { MapPin, Phone } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import type { Customer } from '../data/customer.api';
import { formatCustomerAddress, formatPhone } from '../data/customer.util';

type CustomerDeliverySummaryProps = {
  customer: Customer;
  /** Abre o formulário com os dados atuais. */
  onEdit: () => void;
};

/** Resumo dos dados de entrega salvos no checkout: endereço em uma linha, telefone e "Alterar". */
export function CustomerDeliverySummary({ customer, onEdit }: CustomerDeliverySummaryProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface px-[18px] py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2 text-[13.5px] leading-[1.55]">
        <p className="flex items-start gap-2.5 font-bold text-ink">
          <MapPin className="mt-[3px] size-4 shrink-0 text-muted-ink" strokeWidth={2.2} aria-hidden="true" />
          <span>{formatCustomerAddress(customer.address)}</span>
        </p>
        <p className="flex items-center gap-2.5 text-ink-soft">
          <Phone className="size-4 shrink-0 text-muted-ink" strokeWidth={2.2} aria-hidden="true" />
          <span className="tabular-nums">{formatPhone(customer.phone)}</span>
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={onEdit}>
        Alterar
      </Button>
    </div>
  );
}
