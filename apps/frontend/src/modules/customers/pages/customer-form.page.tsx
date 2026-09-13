'use client';

import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { FormSkeleton } from '@/shared/components/ui/form-skeleton';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { CustomerForm } from '../components/customer-form.component';
import { useCustomerForm } from '../data/use-customer-form.hook';

type CustomerFormPageProps = {
  /** Cliente a editar; não existe página de criação. */
  id: string;
  /** Query string da lista (sem `?`) de onde o formulário foi aberto; salvar e cancelar voltam para ela. */
  returnQuery?: string;
};

/** Edição de cliente em página (`/admin/customers/:id`). */
export function CustomerFormPage({ id, returnQuery }: CustomerFormPageProps) {
  const { form, loading, name, email, listHref, submit } = useCustomerForm({ id, returnQuery });

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title="Editar cliente"
        subtitle="Altere os dados de entrega e a situação do cliente."
        aside={
          <Button asChild variant="outline" size="sm">
            <Link href={listHref}>← Voltar para clientes</Link>
          </Button>
        }
      />

      {loading ? (
        <FormSkeleton sections={4} rowsPerSection={2} />
      ) : (
        <CustomerForm form={form} name={name} email={email} onSubmit={submit} cancelHref={listHref} />
      )}
    </div>
  );
}
