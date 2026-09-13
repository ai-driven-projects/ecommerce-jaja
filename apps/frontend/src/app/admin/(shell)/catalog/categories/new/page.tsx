import { CategoryFormPage } from '@/modules/catalog/pages/category-form.page';

type NewCategoryRouteProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Criação de categoria: `?parentId=<id>` pré-seleciona a pai ("Nova subcategoria" na árvore).
export default async function Page({ searchParams }: NewCategoryRouteProps) {
  const { parentId } = await searchParams;
  const initialParentId = typeof parentId === 'string' && parentId !== '' ? parentId : undefined;

  // A chave remonta o formulário quando só a query muda (outra "Nova subcategoria").
  return <CategoryFormPage key={initialParentId ?? 'root'} parentId={initialParentId} />;
}
