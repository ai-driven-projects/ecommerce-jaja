'use client';

import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { FormSkeleton } from '@/shared/components/ui/form-skeleton';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { CategoryForm } from '../components/category-form.component';
import { useCategoryForm } from '../data/use-category-form.hook';

type CategoryFormPageProps = {
  /** Sem `id` a página cria uma categoria; com `id` carrega e altera. */
  id?: string;
  /** Pai pré-selecionada na criação (`?parentId=`). */
  parentId?: string;
  /** Query string da lista (sem `?`) de onde o formulário foi aberto; salvar e cancelar voltam para ela. */
  returnQuery?: string;
};

/**
 * Criação (`/admin/catalog/categories/new`, aceita `?parentId=`) e edição
 * (`/admin/catalog/categories/:id`) de categoria em página.
 */
export function CategoryFormPage({ id, parentId, returnQuery }: CategoryFormPageProps) {
  const { form, isEditing, loading, listHref, parentSelect, submit } = useCategoryForm({ id, parentId, returnQuery });

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
            <Link href={listHref}>← Voltar para categorias</Link>
          </Button>
        }
      />

      {loading ? (
        <FormSkeleton sections={3} rowsPerSection={2} />
      ) : (
        <CategoryForm
          form={form}
          isEditing={isEditing}
          parentSelect={parentSelect}
          onSubmit={submit}
          cancelHref={listHref}
        />
      )}
    </div>
  );
}
