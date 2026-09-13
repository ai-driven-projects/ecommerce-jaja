'use client';

import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { FormSkeleton } from '@/shared/components/ui/form-skeleton';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { CATALOG_CATEGORIES_ROUTE } from '@/shared/navigation/catalog-routes';
import { CategoryForm } from '../components/category-form.component';
import { useCategoryForm } from '../data/use-category-form.hook';

type CategoryFormPageProps = {
  /** Sem `id` a página cria uma categoria; com `id` carrega e altera. */
  id?: string;
  /** Pai pré-selecionada na criação (`?parentId=`). */
  parentId?: string;
};

/**
 * Criação (`/admin/catalog/categories/new`, aceita `?parentId=`) e edição
 * (`/admin/catalog/categories/:id`) de categoria em página.
 */
export function CategoryFormPage({ id, parentId }: CategoryFormPageProps) {
  const { form, isEditing, loading, parentOptions, submit } = useCategoryForm({ id, parentId });

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title={isEditing ? 'Editar categoria' : 'Nova categoria'}
        subtitle={
          isEditing
            ? 'Altere os dados, a posição na árvore e o status da categoria.'
            : 'Cadastre um departamento, grupo ou subgrupo para organizar o catálogo.'
        }
        aside={
          <Button asChild variant="outline" size="sm">
            <Link href={CATALOG_CATEGORIES_ROUTE}>← Voltar para categorias</Link>
          </Button>
        }
      />

      {loading ? (
        <FormSkeleton sections={3} rowsPerSection={2} />
      ) : (
        <CategoryForm
          form={form}
          isEditing={isEditing}
          parentOptions={parentOptions}
          onSubmit={submit}
          cancelHref={CATALOG_CATEGORIES_ROUTE}
        />
      )}
    </div>
  );
}
