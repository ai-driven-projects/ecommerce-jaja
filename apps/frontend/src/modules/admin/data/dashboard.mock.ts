import { COURIERS_ONLINE, PRODUCTS, type Product } from '@/modules/catalog/data';

/**
 * Dados locais de exemplo do dashboard administrativo. Sem chamadas à API:
 * quando houver endpoints de pedidos e entregadores, só este arquivo muda.
 */

export type DeltaTone = 'success' | 'danger' | 'warning' | 'muted';

export type DashboardKpi = {
  id: string;
  label: string;
  value: string;
  delta: string;
  deltaTone: DeltaTone;
  icon: string;
  /** Classe de fundo do quadradinho do ícone (`bg-tint-*`). */
  tintClassName: string;
};

export type OrderStatus = 'separando' | 'caminho' | 'entregue' | 'atrasado';

export type OngoingOrder = {
  id: string;
  destination: string;
  itemsLabel: string;
  /** Modo do entregador: bike ou a pé. */
  mode: 'bike' | 'foot';
  courier: string;
  status: OrderStatus;
  etaLabel: string;
  late?: boolean;
  totalCents: number;
};

export type HourlyBar = {
  hour: string;
  minutes: number;
};

export type LowStockProduct = Product & {
  /** Estoque considerado cheio, para a barra de progresso. */
  capacity: number;
};

export const ORDERS_TODAY = 128;
export const REVENUE_TODAY_CENTS = 1_105_920;
export const AVERAGE_DELIVERY_MINUTES = 24;
export const ON_TIME_RATE = 96;
export const DELIVERY_TARGET_MINUTES = 30;

export const DASHBOARD_KPIS: readonly DashboardKpi[] = [
  { id: 'orders', label: 'Pedidos hoje', value: String(ORDERS_TODAY), delta: '↑ 12% vs. sexta passada', deltaTone: 'success', icon: '📦', tintClassName: 'bg-tint-peach' },
  { id: 'avg-time', label: 'Tempo médio de entrega', value: `${AVERAGE_DELIVERY_MINUTES} min`, delta: '↓ 3 min vs. ontem', deltaTone: 'success', icon: '⏱️', tintClassName: 'bg-tint-mint' },
  { id: 'ticket', label: 'Ticket médio', value: 'R$ 86,40', delta: '↑ R$ 4,10 vs. ontem', deltaTone: 'success', icon: '🧾', tintClassName: 'bg-tint-blue' },
  { id: 'on-time', label: 'Entregas no prazo', value: `${ON_TIME_RATE}%`, delta: 'Meta: 95%', deltaTone: 'muted', icon: '✅', tintClassName: 'bg-tint-green' },
];

export const ORDER_STATUS_LABEL: Readonly<Record<OrderStatus, string>> = {
  separando: 'Separando',
  caminho: 'A caminho',
  entregue: 'Entregue',
  atrasado: 'Atrasado',
};

export const ONGOING_ORDERS: readonly OngoingOrder[] = [
  { id: '4211', destination: 'Av. Santos Dumont, 1500 · 12º', itemsLabel: '3 itens', mode: 'bike', courier: 'Rafael L.', status: 'caminho', etaLabel: '9 min', totalCents: 8870 },
  { id: '4212', destination: 'R. Tibúrcio Cavalcante, 2200 · 5º', itemsLabel: '1 item', mode: 'foot', courier: 'Bia M.', status: 'caminho', etaLabel: '14 min', totalCents: 3290 },
  { id: '4213', destination: 'Av. Dom Luís, 1842 · 8º', itemsLabel: '6 itens', mode: 'bike', courier: 'Diego S.', status: 'separando', etaLabel: '—', totalCents: 21430 },
  { id: '4214', destination: 'R. Vicente Leite, 595', itemsLabel: '2 itens', mode: 'bike', courier: 'Carla N.', status: 'atrasado', etaLabel: '+6 min', late: true, totalCents: 4980 },
  { id: '4215', destination: 'Av. Desembargador Moreira, 726 · 3º', itemsLabel: '4 itens', mode: 'foot', courier: 'João P.', status: 'separando', etaLabel: '—', totalCents: 12760 },
  { id: '4209', destination: 'R. Ana Bilhar, 1508 · 2º', itemsLabel: '2 itens', mode: 'bike', courier: 'Rafael L.', status: 'entregue', etaLabel: '19 min', totalCents: 6180 },
];

/** Pedidos ainda não entregues (contador do menu lateral). */
export const ONGOING_ORDERS_COUNT = 23;

export const HOURLY_BARS: readonly HourlyBar[] = [
  { hour: '8h', minutes: 21 },
  { hour: '9h', minutes: 26 },
  { hour: '10h', minutes: 23 },
  { hour: '11h', minutes: 28 },
  { hour: '12h', minutes: 35 },
  { hour: '13h', minutes: 31 },
  { hour: '14h', minutes: 24 },
  { hour: '15h', minutes: 22 },
];

export const LOW_STOCK_THRESHOLD = 25;

export const LOW_STOCK_PRODUCTS: readonly LowStockProduct[] = PRODUCTS.filter((product) => product.stock <= LOW_STOCK_THRESHOLD)
  .sort((a, b) => a.stock - b.stock)
  .slice(0, 4)
  .map((product) => ({ ...product, capacity: Math.max(60, Math.ceil(product.stock / 0.2)) }));

export { COURIERS_ONLINE };
