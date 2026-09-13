'use client';

import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { EmptyListState } from '@/shared/components/ui/empty-list-state';
import { FormSkeleton } from '@/shared/components/ui/form-skeleton';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { ProductForm } from '../components/product-form.component';
import { useProductForm } from '../data/use-product-form.hook';

type ProductFormPageProps = {
  /** Sem `id` a página cria um produto; com `id` carrega e altera. */
  id?: string;
  /** Query string da lista (sem `?`) de onde o formulário foi aberto; salvar e cancelar voltam para ela. */
  returnQuery?: string;
};

/**
 * Criação (`/admin/catalog/products/new`) e edição (`/admin/catalog/products/:id`)
 * de produto em página. Produto inexistente mostra o estado de não encontrado.
 */
export function ProductFormPage({ id, returnQuery }: ProductFormPageProps) {
  const { form, isEditing, loading, loadError, brandSelect, categorySelect, listHref, submit } = useProductForm({
    id,
    returnQuery,
  });

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title={isEditing ? 'Editar produto' : 'Novo produto'}
        subtitle={
          isEditing
            ? 'Altere os dados, o preço, as imagens e a publicação do produto.'
            : 'Cadastre um produto com classificação, preço e imagens.'
        }
        aside={
          <Button asChild variant="outline" size="sm">
            <Link href={listHref}>← Voltar para produtos</Link>
          </Button>
        }
      />

      {loadError ? (
        <EmptyListState
          emoji={loadError.notFound ? '🔎' : '⚠️'}
          title={loadError.notFound ? 'Produto não encontrado' : 'Não foi possível carregar o produto'}
          subtitle={
            loadError.notFound
              ? `${loadError.message} Ele pode ter sido excluído; volte para a lista e escolha outro.`
              : loadError.message
          }
        />
      ) : loading ? (
        <FormSkeleton sections={5} rowsPerSection={2} />
      ) : (
        <ProductForm
          form={form}
          isEditing={isEditing}
          brandSelect={brandSelect}
          categorySelect={categorySelect}
          onSubmit={submit}
          cancelHref={listHref}
        />
      )}
    </div>
  );
}
