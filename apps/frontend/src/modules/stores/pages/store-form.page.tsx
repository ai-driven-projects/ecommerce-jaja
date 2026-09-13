'use client';

import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { FormSkeleton } from '@/shared/components/ui/form-skeleton';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { StoreForm } from '../components/store-form.component';
import { useStoreForm } from '../data/use-store-form.hook';

type StoreFormPageProps = {
  /** Sem `id` a página cria uma loja; com `id` carrega e altera. */
  id?: string;
  /** Query string da lista (sem `?`) de onde o formulário foi aberto; salvar e cancelar voltam para ela. */
  returnQuery?: string;
};

/** Criação (`/admin/stores/new`) e edição (`/admin/stores/:id`) de loja em página. */
export function StoreFormPage({ id, returnQuery }: StoreFormPageProps) {
  const { form, token, isEditing, loading, listHref, submit } = useStoreForm({ id, returnQuery });

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title={isEditing ? 'Editar loja' : 'Nova loja'}
        subtitle={
          isEditing
            ? 'Altere os dados, a localização e o status da loja.'
            : 'Cadastre uma loja com o ponto no mapa e o raio de atendimento.'
        }
        aside={
          <Button asChild variant="outline" size="sm">
            <Link href={listHref}>← Voltar para lojas</Link>
          </Button>
        }
      />

      {loading ? (
        <FormSkeleton sections={3} rowsPerSection={3} />
      ) : (
        <StoreForm form={form} token={token} isEditing={isEditing} onSubmit={submit} cancelHref={listHref} />
      )}
    </div>
  );
}
