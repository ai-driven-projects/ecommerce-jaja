import { CATEGORY_ALL, type Category, type Product, type ProductCategory, type Zone } from './storefront.types';

/** Filtros da vitrine, na ordem de exibição, com o emoji dos chips. */
export const CATEGORY_OPTIONS: ReadonlyArray<{ id: Category; label: string; emoji: string }> = [
  { id: CATEGORY_ALL, label: 'Tudo', emoji: '🛒' },
  { id: 'papelaria', label: 'Papelaria', emoji: '✏️' },
  { id: 'impressão', label: 'Impressão', emoji: '🖨️' },
  { id: 'café e lanches', label: 'Copa', emoji: '☕' },
  { id: 'limpeza de escritório', label: 'Limpeza', emoji: '🧽' },
  { id: 'tecnologia básica', label: 'Informática', emoji: '💻' },
];

export const CATEGORIES: readonly Category[] = CATEGORY_OPTIONS.map((option) => option.id);

export function categoryLabel(category: Category): string {
  return CATEGORY_OPTIONS.find((option) => option.id === category)?.label ?? category;
}

/** Bairros atendidos, agrupados por loja (a ordem define a ordem de exibição). */
export const ZONES: readonly Zone[] = [
  { neighborhood: 'Aldeota', store: 'Loja Aldeota' },
  { neighborhood: 'Meireles', store: 'Loja Aldeota' },
  { neighborhood: 'Centro', store: 'Loja Aldeota' },
  { neighborhood: 'Cocó', store: 'Loja Cocó' },
  { neighborhood: 'Dionísio Torres', store: 'Loja Cocó' },
];

/** Bairros que constam no seletor mas ainda não são atendidos. */
export const UNSERVED_NEIGHBORHOODS: readonly string[] = ['Papicu', 'Montese', 'Messejana'];

/** Tempo estimado de entrega, em minutos, por bairro atendido. */
export const ETA_BY_NEIGHBORHOOD: Readonly<Record<string, number>> = {
  Aldeota: 18,
  Meireles: 22,
  Centro: 27,
  Cocó: 20,
  'Dionísio Torres': 24,
};

/** Entregadores online agora (dado local de exemplo para o hero e o admin). */
export const COURIERS_ONLINE = 14;

export function storeOf(neighborhood: string): string | null {
  return ZONES.find((zone) => zone.neighborhood === neighborhood)?.store ?? null;
}

const p = (
  slug: string,
  name: string,
  category: ProductCategory,
  priceCents: number,
  unit: string,
  emoji: string,
  description: string,
  specs: ReadonlyArray<readonly [string, string]>,
  stock: number,
  extra: Partial<Pick<Product, 'oldPriceCents' | 'highlight'>> = {},
): Product => ({ slug, name, category, priceCents, unit, emoji, description, specs, stock, ...extra });

export const PRODUCTS: readonly Product[] = [
  // impressão
  p('papel-sulfite-a4-500-folhas', 'Papel sulfite A4 branco', 'impressão', 3290, 'Resma 500 folhas · 75g', '📄',
    'Resma com 500 folhas A4 (210 × 297 mm), gramatura 75g/m². Alta alvura para impressões nítidas em jato de tinta e laser. Embalagem com proteção contra umidade — chega pronta para ir direto para a bandeja da impressora.',
    [['Formato', 'A4'], ['Gramatura', '75g/m²'], ['Folhas', '500'], ['Alvura', '96%']], 14, { highlight: 'top' }),
  p('toner-preto-compativel-85a', 'Toner preto compatível 85A', 'impressão', 28900, 'Rende ~1.000 páginas', '🖨️',
    'Toner compatível com impressoras HP LaserJet P1102, M1132 e M1212. Rendimento aproximado de 1.000 páginas com 5% de cobertura. Chip novo, pronto para uso.',
    [['Compatível', 'HP 85A'], ['Rendimento', '~1.000 pág.'], ['Cor', 'Preto'], ['Garantia', '90 dias']], 42, { highlight: 'top' }),
  p('cartucho-tinta-colorido-664', 'Cartucho de tinta colorido 664', 'impressão', 7490, 'Tricolor · ~100 páginas', '🎨',
    'Cartucho original tricolor para impressoras HP DeskJet Ink Advantage série 1115, 2136, 3636 e 4536.',
    [['Compatível', 'HP 664'], ['Rendimento', '~100 pág.'], ['Cor', 'Tricolor'], ['Tipo', 'Original']], 31),
  p('etiqueta-adesiva-a4-branca-100-folhas', 'Etiqueta adesiva A4 branca', 'impressão', 3990, 'Caixa com 100 folhas', '🏷️',
    'Folhas A4 de etiquetas brancas com corte 25,4 × 99 mm (22 por folha), para impressoras laser e jato de tinta.',
    [['Formato', 'A4'], ['Etiquetas/folha', '22'], ['Folhas', '100'], ['Adesivo', 'Permanente']], 58),

  // papelaria
  p('caneta-esferografica-azul-caixa-12', 'Caneta esferográfica azul', 'papelaria', 1850, 'Caixa com 12 un', '🖊️',
    'Caneta esferográfica ponta média 1.0 mm, escrita macia e sem falhas. Corpo transparente para acompanhar o nível da tinta.',
    [['Ponta', '1.0 mm'], ['Cor', 'Azul'], ['Quantidade', '12 un'], ['Tampa', 'Ventilada']], 120, { highlight: 'top' }),
  p('bloco-adesivo-76x76-amarelo', 'Bloco adesivo 76×76 amarelo', 'papelaria', 2490, 'Pack com 4 blocos', '🗒️',
    'Quatro blocos de 100 folhas com adesivo reposicionável que não deixa resíduo. O amarelo clássico que todo mundo enxerga.',
    [['Tamanho', '76 × 76 mm'], ['Folhas', '100 por bloco'], ['Blocos', '4'], ['Cor', 'Amarelo']], 64, { highlight: 'top' }),
  p('caderno-pautado-96-folhas', 'Caderno pautado 96 folhas', 'papelaria', 1290, 'Capa dura · A5', '📓',
    'Caderno A5 de capa dura com 96 folhas pautadas de 63g. Costurado, abre plano e aguenta a rotina de reunião.',
    [['Formato', 'A5'], ['Folhas', '96'], ['Pauta', 'Pautado'], ['Capa', 'Dura']], 37),
  p('clipes-galvanizados-n2-caixa-100', 'Clipes galvanizados nº 2', 'papelaria', 350, 'Caixa com 100 un', '📎',
    'Clipes de aço galvanizado nº 2 (28 mm), sem rebarbas, para até 20 folhas.',
    [['Tamanho', 'nº 2 · 28 mm'], ['Quantidade', '100'], ['Material', 'Aço galvanizado'], ['Capacidade', '~20 folhas']], 210),
  p('grampeador-de-mesa-26-6', 'Grampeador + 1.000 grampos', 'papelaria', 3990, 'Grampeia até 25 folhas', '🖇️',
    'Grampeador de mesa metálico para grampos 26/6, com base antiderrapante e caixa de 1.000 grampos inclusa.',
    [['Grampo', '26/6'], ['Capacidade', '25 folhas'], ['Grampos inclusos', '1.000'], ['Corpo', 'Metálico']], 18, { highlight: 'restock' }),
  p('kit-volta-ao-escritorio', 'Kit volta ao escritório', 'papelaria', 3990, 'Canetas + marca-textos + post-its', '✏️',
    'Kit com 6 canetas esferográficas, 4 marca-textos pastel e 2 blocos adesivos. Tudo que uma mesa nova precisa no primeiro dia.',
    [['Canetas', '6'], ['Marca-textos', '4'], ['Blocos adesivos', '2'], ['Embalagem', 'Caixa presente']], 25, { oldPriceCents: 4990 }),
  p('organizador-de-mesa-acrilico', 'Organizador de mesa acrílico', 'papelaria', 6490, '4 divisórias · fumê', '🗂️',
    'Organizador de mesa em acrílico fumê com quatro divisórias para canetas, blocos e cartões.',
    [['Material', 'Acrílico'], ['Divisórias', '4'], ['Cor', 'Fumê'], ['Medidas', '20 × 12 × 10 cm']], 12, { oldPriceCents: 7990 }),

  // café e lanches
  p('cafe-em-capsulas-intenso', 'Café em cápsulas intenso', 'café e lanches', 2790, 'Caixa com 10 cápsulas', '☕',
    'Cápsulas compatíveis com máquinas Nespresso®. Torra escura, intensidade 10, notas de cacau e um corpo que segura a tarde.',
    [['Compatível', 'Nespresso®'], ['Cápsulas', '10'], ['Intensidade', '10/12'], ['Torra', 'Escura']], 9, { highlight: 'top' }),
  p('cafe-torrado-e-moido-500g', 'Café torrado e moído 500g', 'café e lanches', 2990, 'Torra média · moagem fina', '🫘',
    'Café 100% arábica torrado e moído, torra média, embalado a vácuo. Rende cerca de 60 xícaras.',
    [['Peso', '500 g'], ['Torra', 'Média'], ['Moagem', 'Fina'], ['Rende', '~60 xícaras']], 40, { oldPriceCents: 3690 }),
  p('agua-mineral-sem-gas-510ml-pack-6', 'Água mineral sem gás 510ml', 'café e lanches', 1490, 'Pack com 6 un', '💧',
    'Pack com seis garrafas de 510 ml de água mineral sem gás, baixo teor de sódio.',
    [['Volume', '510 ml'], ['Unidades', '6'], ['Tipo', 'Sem gás'], ['Sódio', 'Baixo']], 22, { highlight: 'top' }),
  p('copo-descartavel-200ml-100-unidades', 'Copo descartável 200ml', 'café e lanches', 990, 'Pacote com 100 un', '🥤',
    'Copos descartáveis de 200 ml em PP translúcido, resistentes a bebidas quentes.',
    [['Volume', '200 ml'], ['Unidades', '100'], ['Material', 'PP'], ['Uso', 'Quente e frio']], 150, { highlight: 'restock' }),
  p('biscoito-agua-e-sal-400g', 'Biscoito água e sal 400g', 'café e lanches', 590, 'Pacote com 3 sleeves', '🍪',
    'Biscoito água e sal crocante em três pacotes internos, para não perder a crocância entre uma reunião e outra.',
    [['Peso', '400 g'], ['Sleeves', '3'], ['Sabor', 'Água e sal'], ['Validade', '6 meses']], 48),

  // limpeza de escritório
  p('alcool-em-gel-70-500ml', 'Álcool em gel 70%', 'limpeza de escritório', 1690, 'Frasco 500ml com válvula', '🧴',
    'Álcool etílico em gel 70% com válvula pump, hidratante e sem cheiro forte. Para recepção, mesas e copa.',
    [['Volume', '500 ml'], ['Concentração', '70%'], ['Válvula', 'Pump'], ['Registro', 'ANVISA']], 33, { highlight: 'restock' }),
  p('papel-toalha-interfolha-1000-folhas', 'Papel toalha interfolha', 'limpeza de escritório', 2250, 'Pacote com 1.000 folhas', '🧻',
    'Papel toalha interfolhado 2 dobras, 100% celulose virgem, 1.000 folhas de 20 × 21 cm. Compatível com os dispensers comuns.',
    [['Folhas', '1.000'], ['Dobras', '2'], ['Medida', '20 × 21 cm'], ['Celulose', 'Virgem']], 27, { highlight: 'restock' }),
  p('detergente-neutro-500ml', 'Detergente neutro 500ml', 'limpeza de escritório', 290, 'Frasco', '🫧',
    'Detergente líquido neutro, biodegradável, para louça e superfícies da copa.',
    [['Volume', '500 ml'], ['Fragrância', 'Neutra'], ['Biodegradável', 'Sim'], ['pH', 'Neutro']], 75),
  p('saco-de-lixo-50-litros-100-unidades', 'Saco de lixo 50 litros', 'limpeza de escritório', 1990, 'Rolo com 100 un', '🗑️',
    'Sacos de lixo reforçados de 50 litros, em rolo picotado com 100 unidades.',
    [['Capacidade', '50 L'], ['Unidades', '100'], ['Espessura', 'Reforçado'], ['Cor', 'Preto']], 52),

  // tecnologia básica
  p('cabo-usb-c-reforcado-1m', 'Cabo USB-C reforçado 1m', 'tecnologia básica', 3490, 'Carga rápida 60W', '🔌',
    'Cabo USB-C para USB-C com malha de nylon e conectores de alumínio. Suporta carga rápida de até 60 W e transferência de dados.',
    [['Comprimento', '1 m'], ['Potência', '60 W'], ['Conector', 'USB-C ↔ USB-C'], ['Revestimento', 'Nylon']], 44, { highlight: 'restock' }),
  p('pilha-alcalina-aa-cartela-4', 'Pilha AA alcalina', 'tecnologia básica', 2190, 'Cartela com 4 un', '🔋',
    'Pilhas alcalinas AA de longa duração para mouses, teclados e controles.',
    [['Tamanho', 'AA'], ['Unidades', '4'], ['Tipo', 'Alcalina'], ['Validade', '10 anos']], 6, { highlight: 'restock' }),
  p('mouse-sem-fio-silencioso', 'Mouse sem fio silencioso', 'tecnologia básica', 6990, 'USB · 1.600 dpi', '🖱️',
    'Mouse óptico sem fio 2.4 GHz com cliques silenciosos e três níveis de sensibilidade. Receptor USB nano incluso.',
    [['Conexão', 'USB 2.4 GHz'], ['Sensibilidade', '1.600 dpi'], ['Cliques', 'Silenciosos'], ['Alimentação', '1 pilha AA']], 15, { oldPriceCents: 8990 }),
  p('cabo-hdmi-2m', 'Cabo HDMI 2 m', 'tecnologia básica', 2990, 'HDMI 2.0 · 4K', '📺',
    'Cabo HDMI 2.0 de 2 metros, suporte a 4K 60 Hz, conectores banhados a ouro. Para a TV da sala de reunião.',
    [['Comprimento', '2 m'], ['Versão', 'HDMI 2.0'], ['Resolução', '4K 60 Hz'], ['Conectores', 'Banhados a ouro']], 29),
  p('filtro-de-linha-5-tomadas', 'Filtro de linha 5 tomadas', 'tecnologia básica', 4590, 'Cabo de 1,5 m · bivolt', '🔌',
    'Filtro de linha com cinco tomadas 10 A, chave liga/desliga iluminada e proteção contra surtos.',
    [['Tomadas', '5'], ['Corrente', '10 A'], ['Cabo', '1,5 m'], ['Proteção', 'Surto']], 21),
];

export function findProduct(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}
