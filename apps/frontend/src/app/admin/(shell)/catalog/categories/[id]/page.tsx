import { CategoryFormPage } from '@/modules/catalog/pages/category-form.page';

type CategoryRouteProps = {
  params: Promise<{ id: string }>;
};

// Edição de categoria: a rota só resolve o `id`; a página carrega a categoria no cliente.
export default async function Page({ params }: CategoryRouteProps) {
  const { id } = await params;
  return <CategoryFormPage id={id} />;
}
