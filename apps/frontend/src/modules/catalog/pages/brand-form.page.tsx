'use client';

import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { FormSkeleton } from '@/shared/components/ui/form-skeleton';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { BrandForm } from '../components/brand-form.component';
import { useBrandForm } from '../data/use-brand-form.hook';

type BrandFormPageProps = {
  /** Sem `id` a página cria uma marca; com `id` carrega e altera. */
  id?: string;
  /** Query string da lista (sem `?`) de onde o formulário foi aberto; salvar e cancelar voltam para ela. */
  returnQuery?: string;
};

/** Criação (`/admin/catalog/brands/new`) e edição (`/admin/catalog/brands/:id`) de marca em página. */
export function BrandFormPage({ id, returnQuery }: BrandFormPageProps) {
  const { form, isEditing, loading, listHref, submit } = useBrandForm({ id, returnQuery });

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title={isEditing ? 'Editar marca' : 'Nova marca'}
        subtitle={isEditing ? 'Altere os dados e o status da marca.' : 'Cadastre uma marca para usar nos produtos do catálogo.'}
        aside={
          <Button asChild variant="outline" size="sm">
            <Link href={listHref}>← Voltar para marcas</Link>
          </Button>
        }
      />

      {loading ? (
        <FormSkeleton sections={2} rowsPerSection={2} />
      ) : (
        <BrandForm form={form} isEditing={isEditing} onSubmit={submit} cancelHref={listHref} />
      )}
    </div>
  );
}
