import { ApiError, apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP dos clientes: `/customers` (só administradores) e
 * `/me/customer` (qualquer usuário autenticado, o próprio cadastro). Funções
 * puras sobre `apiRequest`: recebem o token da sessão e lançam `ApiError` em
 * resposta com erro.
 */

/** Endereço de entrega como devolvido pela API: CEP só com dígitos e UF em maiúsculas. */
export type CustomerAddress = {
  zipCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
};

/** Cliente devolvido pelo `PUT` (`CustomerDTO`): sem nome e email; CPF e telefone só com dígitos; datas em ISO. */
export type Customer = {
  id: string;
  userId: string;
  cpf: string;
  phone: string;
  address: CustomerAddress;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Cliente com `name` e `email` do usuário vinculado (`CustomerDetailDTO`), devolvido pelos `GET`. */
export type CustomerDetail = Customer & {
  name: string;
  email: string;
};

/** Linha de `GET /customers` (`CustomerListItemDTO`). */
export type CustomerListItem = {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  neighborhood: string;
  city: string;
  state: string;
  isActive: boolean;
};

/** Uma página de `GET /customers` (`CustomerPageDTO`). */
export type CustomerPage = {
  items: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Corpo de `PUT /me/customer` e `PUT /customers/:id`. O endereço é sempre
 * substituído inteiro; `complement` vazio vai como `null`. `isActive` só vale
 * na alteração administrativa (a API o ignora em `/me/customer`).
 */
export type CustomerInput = {
  cpf: string;
  phone: string;
  address: Omit<CustomerAddress, 'complement'> & { complement?: string | null };
  isActive?: boolean;
};

/**
 * Filtros da listagem. Sem `page`/`pageSize` a API usa a página 1 com 20
 * clientes; `search` é texto livre sobre nome, email, CPF, telefone e bairro.
 */
export type CustomerFilter = {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
};

const CUSTOMERS_PATH = '/customers';
const MY_CUSTOMER_PATH = '/me/customer';

function customerPath(id: string): string {
  return `${CUSTOMERS_PATH}/${encodeURIComponent(id)}`;
}

/**
 * Uma página de clientes: ordenada pelo nome do usuário, ou pelos que melhor
 * casam com a busca. A query string só leva os filtros definidos.
 */
export function listCustomers(token: string, filter: CustomerFilter = {}): Promise<CustomerPage> {
  const params = new URLSearchParams();
  const search = filter.search?.trim();

  if (filter.page !== undefined) params.set('page', String(filter.page));
  if (filter.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
  if (search) params.set('search', search);
  if (filter.isActive !== undefined) params.set('isActive', String(filter.isActive));

  const query = params.toString();
  return apiRequest<CustomerPage>(query ? `${CUSTOMERS_PATH}?${query}` : CUSTOMERS_PATH, { token });
}

/** Busca um cliente; inexistente (inclusive id que não é uuid) responde `404 CUSTOMER_NOT_FOUND`. */
export function getCustomer(token: string, id: string): Promise<CustomerDetail> {
  return apiRequest<CustomerDetail>(customerPath(id), { token });
}

/** Alteração administrativa; id inexistente responde `404 CUSTOMER_NOT_FOUND`, sem criar. */
export function updateCustomer(token: string, id: string, data: CustomerInput): Promise<Customer> {
  return apiRequest<Customer>(customerPath(id), { method: 'PUT', token, body: data });
}

/**
 * Cadastro de cliente do usuário da sessão, ou `null` quando ele ainda não tem
 * (`404 CUSTOMER_NOT_FOUND`). Os demais erros são propagados.
 */
export async function getMyCustomer(token: string): Promise<CustomerDetail | null> {
  try {
    return await apiRequest<CustomerDetail>(MY_CUSTOMER_PATH, { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.codes.includes('CUSTOMER_NOT_FOUND')) {
      return null;
    }
    throw error;
  }
}

/** Cria (sem cadastro) ou altera (com cadastro) o cliente do usuário da sessão. */
export function saveMyCustomer(token: string, data: CustomerInput): Promise<Customer> {
  return apiRequest<Customer>(MY_CUSTOMER_PATH, { method: 'PUT', token, body: data });
}
