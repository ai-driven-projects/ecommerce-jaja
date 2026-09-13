import { CustomerFormPage } from '@/modules/customers/pages/customer-form.page';
import { toQueryString, type RouteSearchParams } from '@/shared/util/query-string.util';

type CustomerRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<RouteSearchParams>;
};

// Edição de cliente: a rota resolve o `id` e a query da lista (retorno); a página carrega o cliente no cliente.
// Não há `/new`: `/admin/customers/new` cai aqui, a API responde 404 e a tela volta para a lista.
export default async function Page({ params, searchParams }: CustomerRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <CustomerFormPage key={id} id={id} returnQuery={toQueryString(query)} />;
}
