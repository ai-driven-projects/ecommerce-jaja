# já já — design (leia antes de escrever qualquer tela)

Direção: modernista e flat — grade visível, o alinhamento e os divisores
fazem toda a organização. Nada flutua, nada é decorado.

## Tokens (CSS custom properties em apps/web)
- `--bg: #f3f2f2` (papel) · `--surface: #eae9e9` (área de imagem, campos)
- `--ink: #201e1d` (texto e divisores) · `--accent: #ec3013` (vermelho)
- `--divider`: sempre `2px solid var(--ink)` — nunca hairline
- Radius: **0 em tudo**. Sombras: nenhuma.

## Tipografia
- **Archivo** (400 / 600 / 800) para todo o texto e UI.
- **Bricolage Grotesque** (opsz alto) só para display: o nome do produto na
  página de detalhe.
- **IBM Plex Mono** para números — preços, ETA, contadores — sempre com
  `font-variant-numeric: tabular-nums`.
- Tudo alinhado à esquerda, inclusive labels dentro de botões largos.
- Preço sempre em mono no formato `R$ 12,90`.

## Regras
- Divisores fortes de 2px entre seções principais; a grade de produtos usa
  linhas de 2px entre células (gap 2px sobre fundo `--ink`).
- Vermelho com parcimônia: ponto do logo, filtro ativo, ETA, avisos.
  Para texto pequeno em vermelho, garantir contraste (usar tom mais escuro).
- **Nada anima ao carregar a página.** Transições só em hover/estado, ≤120ms.
- Imagens de produto: um SVG monocromático simples por categoria
  (tinta `--ink` sobre papel `--surface`). Sem fotos, sem marcas.
- Foco de teclado: `outline: 2px solid var(--accent); offset 2px`.
- Botão primário: tinta sobre papel — fundo `--ink`, texto `--bg`, label
  alinhado à esquerda, sem radius.
- Carregando: a estrutura da página com réguas e textos em `#B0ADA4`.
  Sem shimmer, sem spinner.
- Ícones: Lucide (https://lucide.dev), traço 2px.

## Vitrine
- Barra superior com borda inferior 2px: logo **"já já."** (Archivo 800,
  minúsculas, ponto final em vermelho), seletor de bairro sublinhado,
  **"chega em X min"** em destaque (mono, tabular), sacola com contador.
- Filtros de categoria: texto sublinhado; o ativo tem sublinhado 2px vermelho.
- Grade: 2 colunas no mobile, 4 no desktop.
- Card: área de imagem em `--surface`, categoria em caixa alta pequena,
  nome Archivo 600, preço mono.
- Estado vazio (bairro não atendido): "Ainda não chegamos aí. Já já." em
  display, com a lista dos bairros atendidos, clicáveis, agrupados por hub.

## Detalhe do produto (/p/:slug)
- Caminho no topo em texto pequeno: vitrine / categoria / nome — cada trecho
  é link; "vitrine" volta preservando bairro e categoria (query params).
- Duas colunas no desktop (imagem ~45% à esquerda), uma no mobile. Sem cards,
  sem sombras; blocos separados por réguas de 2px.
- Imagem: o SVG da categoria, grande, tinta sobre papel.
- Coluna de informação: nome em Bricolage; preço grande em mono + unidade de
  venda em cinza ("a caixa"); disponibilidade como frase ("Tem no hub X." /
  "Últimas 2 no hub X." com o número em vermelho / "Acabou no hub X. Já já
  repõe."); "chega em X min" em mono colado à ação; quantidade (− 1 +) e
  botão único "Adicionar à sacola" (vira "Na sacola" por 1,5 s; se esgotado,
  "Avisar quando voltar"); descrição curta e ficha em linhas chave/valor.
- "Vai junto" no rodapé: até 3 relacionados em linha, imagem pequena, nome e
  preço em mono.

## Acompanhamento do pedido (/pedidos/:id/acompanhar)
- Topo com borda inferior 2px: logo à esquerda; à direita "chega em" +
  contador MM:SS em mono (tabular), atualizado a cada segundo. Na entrega o
  contador vira "chegou" e o ponto do logo acende — exceção consciente:
  transição de 300ms. Contador zerado sem entrega: "já já…".
- Linha de contexto abaixo, com borda inferior 2px:
  "pedido 0427 · 3 itens · Av. Santos Dumont, 1500 · 12º andar".
- Tabela de horários: régua forte (2px) em cima e embaixo, réguas finas
  (1px `#d5d3cf`) entre linhas. Colunas: hora (mono, tabular) | etapa |
  status. Concluída = HH:MM:SS + check; a próxima = "agora" + etiqueta
  "em andamento" (borda 2px vermelha, texto `#b3260f`); as demais =
  travessão e texto em `#B0ADA4`.
- Nada anima ao carregar: a página abre com o histórico já renderizado.
  Uma linha só ganha fade de 200ms quando o evento chega ao vivo pelo SSE.
- **Decisão: nem todo evento merece uma linha para o cliente.**
  `entrega.atribuida` não vira linha da tabela — aparece como rodapé
  ("Rafael, de bike · saiu do Hub Aldeota"). A tabela conta a história do
  pedido; o rodapé dá contexto.
