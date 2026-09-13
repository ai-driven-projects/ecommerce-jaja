/**
 * Dados locais de exemplo do acompanhamento de pedido. Quando houver API e
 * SSE, só este arquivo e o hook que o consome mudam.
 */

export type TrackingStepStatus = 'done' | 'now' | 'todo';

export type TrackingStep = {
  title: string;
  detail: string;
  status: TrackingStepStatus;
};

export type TrackingOrderItem = {
  emoji: string;
  category: string;
  name: string;
  quantity: number;
  totalCents: number;
};

export type TrackingOrder = {
  id: string;
  statusLabel: string;
  confirmedAtLabel: string;
  address: string;
  /** Janela de chegada, já formatada ("14:52 – 14:58"). */
  etaWindow: string;
  remainingMinutes: number;
  courier: { name: string; mode: string; deliveries: number; rating: string; distanceLabel: string; streetLabel: string };
  hub: string;
  steps: TrackingStep[];
  items: TrackingOrderItem[];
  totalCents: number;
  paymentLabel: string;
};

const pad = (value: number) => String(value).padStart(2, '0');
const hhmm = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Monta o pedido de exemplo relativo a `now`, para a janela e os horários ficarem plausíveis. */
export function buildTrackingOrder(id: string, now: Date): TrackingOrder {
  const confirmedAt = new Date(now.getTime() - 11 * 60000);
  const packedAt = new Date(now.getTime() - 8 * 60000);
  const leftAt = new Date(now.getTime() - 3 * 60000);
  const etaStart = new Date(now.getTime() + 9 * 60000);
  const etaEnd = new Date(now.getTime() + 15 * 60000);

  return {
    id,
    statusLabel: 'A caminho',
    confirmedAtLabel: `Confirmado hoje às ${hhmm(confirmedAt)}`,
    address: 'Av. Santos Dumont, 1500 · 12º andar · sala 1204',
    etaWindow: `${hhmm(etaStart)} – ${hhmm(etaEnd)}`,
    remainingMinutes: 9,
    courier: {
      name: 'Rafael Lima',
      mode: 'Entregador de bike',
      deliveries: 1240,
      rating: '4,98',
      distanceLabel: 'a 650 m',
      streetLabel: 'pedalando pela R. Tibúrcio Cavalcante',
    },
    hub: 'Hub Aldeota',
    steps: [
      { title: 'Pedido confirmado', detail: `${hhmm(confirmedAt)} · pagamento aprovado no Pix`, status: 'done' },
      { title: 'Separando no Hub Aldeota', detail: `${hhmm(packedAt)} · 3 itens embalados`, status: 'done' },
      { title: 'Rafael saiu de bike', detail: `${hhmm(leftAt)} · a ~650 m de você`, status: 'now' },
      { title: 'Entregue no 12º andar', detail: 'Aguardando chegada', status: 'todo' },
    ],
    items: [
      { emoji: '📄', category: 'impressão', name: 'Papel sulfite A4 branco', quantity: 1, totalCents: 3290 },
      { emoji: '☕', category: 'café e lanches', name: 'Café em cápsulas intenso', quantity: 2, totalCents: 5580 },
    ],
    totalCents: 8870,
    paymentLabel: 'Total pago no Pix',
  };
}

/** Gera um número de pedido de exemplo para o checkout local. */
export function nextOrderId(): string {
  return String(4200 + Math.floor(Math.random() * 100));
}
