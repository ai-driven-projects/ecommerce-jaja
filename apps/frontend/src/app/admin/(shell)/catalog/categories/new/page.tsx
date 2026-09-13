import { CategoryFormPage } from '@/modules/catalog/pages/category-form.page';
import { toQueryString, type RouteSearchParams } from '@/shared/util/query-string.util';

type NewCategoryRouteProps = {
  searchParams: Promise<RouteSearchParams>;
};

// Criação de categoria: `?parentId=<id>` pré-seleciona a pai ("Nova subcategoria" na lista);
// o restante da query (página e busca da lista) é repassado para o retorno ao salvar/cancelar.
export default async function Page({ searchParams }: NewCategoryRouteProps) {
  const { parentId, ...listParams } = await searchParams;
  const initialParentId = typeof parentId === 'string' && parentId !== '' ? parentId : undefined;
  const returnQuery = toQueryString(listParams);

  // A chave remonta o formulário quando só a query muda (outra "Nova subcategoria").
  return (
    <CategoryFormPage key={initialParentId ?? 'root'} parentId={initialParentId} returnQuery={returnQuery} />
  );
}
