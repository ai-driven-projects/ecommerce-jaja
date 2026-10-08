# Prompts — overview da arquitetura orientada a eventos

Desenhos para abrir a mentoria: **uma imagem de visão geral** com os cinco grandes blocos
da solução e, em seguida, **cinco imagens de foco** — o mesmo desenho, com um bloco aceso
por vez — para conduzir a conversa antes de entrar nos detalhes (desenhos 08 a 14 de
`PROMPTS.md`).

| # | Imagem | Para que serve |
|---|---|---|
| 00 | Visão geral | o todo em uma tela só |
| 00a | Foco: front-end | onde tudo começa e termina |
| 00b | Foco: casos de uso | quem muda o estado |
| 00c | Foco: eventos | o fato que aconteceu |
| 00d | Foco: outbox | a garantia de entrega |
| 00e | Foco: fila | quem distribui |
| 01 | Os eventos do pedido | os cinco fatos do fluxo de venda |

**Como usar:** cole o bloco *Estilo base minimalista* + o prompt do desenho desejado.
Todo texto entre aspas deve aparecer exatamente como está escrito. Nenhum outro texto
além do que está no prompt deve ser inventado.

---

## Estilo base minimalista

> Ilustração educativa em formato 16:9, fundo de papel off-white levemente texturizado,
> como uma página de caderno fotografada — no mesmo estilo de traço dos desenhos
> anteriores da série, mas **muito mais vazia e respirada**.
>
> **Regra principal: pouca informação por tela.** No máximo cinco blocos, cada um com um
> ícone grande, um título de uma ou duas palavras e, no máximo, uma linha curta de
> legenda. Pelo menos metade da área do desenho fica livre. Sem tabelas, sem listas, sem
> nomes de arquivo, sem código, sem caixas aninhadas dentro de caixas.
>
> **Traço:** desenhado à mão com marcador, linhas levemente trêmulas. Blocos de cantos
> bem arredondados, preenchidos com cor pastel e hachura diagonal de lápis suave. Cada
> bloco tem sua cor fixa, que se repete em todos os desenhos desta série:
> front-end = verde-menta · casos de uso = azul-claro · eventos = lilás ·
> outbox = pêssego · fila = amarelo-manteiga.
>
> **Ícones:** adesivos vetoriais planos, simpáticos e grandes (ocupam quase metade do
> bloco), um por bloco, nunca fotografias.
>
> **Título:** letra de mão preta, grossa e arredondada, no topo, com um risco de marcador
> azul levemente ondulado embaixo. Subtítulo curto em cinza, letra de mão menor, em
> minúsculas.
>
> **Setas:** pretas, grossas, desenhadas à mão, com no máximo três palavras de rótulo
> manuscrito. No máximo uma anotação em **letra roxa manuscrita** por desenho, ligada ao
> alvo por seta tracejada roxa.
>
> **Rodapé:** um único post-it amarelo levemente inclinado, com sombra e ícone de
> lâmpada, com uma frase curta manuscrita. Nada mais no rodapé.
>
> **Texto:** todo em português do Brasil, sem erros de grafia, grande e legível. Evitar
> qualquer texto pequeno.

---

## 00 — Visão geral: o pedido em cinco peças

**Título:** "Arquitetura orientada a eventos"
**Subtítulo:** "cinco peças, um caminho só"

**Layout:** cinco blocos grandes em uma única linha horizontal, da esquerda para a
direita, ligados por setas pretas. Cada bloco tem um número desenhado à mão dentro de um
pequeno círculo no canto superior esquerdo. Abaixo da linha, duas setas curvas de
retorno. Muito espaço vazio em volta.

**Blocos (da esquerda para a direita):**

1. Verde-menta, ícone de tela de notebook com carrinho de compras —
   **"Front-end"** / "o cliente fecha o pedido"
2. Azul-claro, ícone de engrenagem — **"Casos de uso"** / "mudam o estado"
3. Lilás, ícone de envelope com um raio — **"Eventos"** / "o que aconteceu"
4. Pêssego, ícone de caixa de saída de correio — **"Outbox"** / "guarda até publicar"
5. Amarelo-manteiga, ícone de esteira com envelopes — **"Fila"** / "entrega a quem ouve"

**Setas entre os blocos (rótulos curtos acima de cada uma):**

- 1 → 2: "requisição"
- 2 → 3: "gera"
- 3 → 4: "mesma transação"
- 4 → 5: "publica depois"

**Setas de retorno (curvas, por baixo da linha):**

- da **Fila** de volta para os **Casos de uso**, rótulo "próximo passo"
- da **Fila** de volta para o **Front-end**, mais longa e mais baixa que a anterior,
  rótulo "a tela se mexe"

**Anotação roxa**, apontando para a seta "próximo passo": "cada evento dispara o
seguinte".

**Post-it:** "ninguém chama ninguém: todos reagem a eventos"

---

## Desenhos de foco (00a a 00e)

Os cinco desenhos abaixo **repetem exatamente o layout do 00** — mesmos blocos, mesmas
posições, mesmas setas — com uma diferença: só o bloco em foco fica colorido, maior e
com três ou quatro risquinhos de brilho ao redor; os outros quatro ficam em cinza-claro,
apagados, com o texto em cinza. Abaixo do bloco aceso aparecem **no máximo três
frases curtas** em letra de mão, cada uma com um pequeno ícone na frente. Mantenha o
mesmo título do 00 e troque só o subtítulo.

### 00a — Foco: front-end

**Subtítulo:** "onde tudo começa — e onde o resultado aparece"
**Bloco aceso:** 1, Front-end (verde-menta). Acender também a seta de retorno "a tela se
mexe".

**Frases sob o bloco:**

- 🛒 "o checkout faz um POST e pronto"
- 📡 "um aviso ao vivo diz «o pedido mudou»"
- 🔄 "a tela busca o pedido de novo na API"

**Post-it:** "o aviso só diz «mexeu»; a API diz o quê"

### 00b — Foco: casos de uso

**Subtítulo:** "o único lugar que muda o estado"
**Bloco aceso:** 2, Casos de uso (azul-claro). Acender também a seta de retorno
"próximo passo".

**Frases sob o bloco:**

- ▶️ "PlaceOrder — chamado pelo front-end"
- ⏭️ "ApproveOrderPayment, DispatchOrder… — chamados pela fila"
- 🚫 "não sabem que existe um broker"

**Post-it:** "o caso de uso grava o evento, não publica"

### 00c — Foco: eventos

**Subtítulo:** "um fato no passado, com nome e data"
**Bloco aceso:** 3, Eventos (lilás). Ao lado do bloco, uma pequena trilha vertical de
cinco envelopes lilases empilhados, ligados por setinhas, cada um com um nome:
"order.placed" → "order.payment-approved" → "order.picking-started" →
"order.out-for-delivery" → "order.delivered".

**Frase sob o bloco:**

- 🕓 "nome no passado: já aconteceu"

**Post-it:** "quem gera o evento não sabe quem vai ouvir"

### 00d — Foco: outbox

**Subtítulo:** "o evento nunca se perde entre o banco e o broker"
**Bloco aceso:** 4, Outbox (pêssego). Ao lado, um cilindro de banco de dados desenhado à
mão com duas etiquetas saindo dele: "pedido" e "evento", unidas por uma chave com o
texto "juntos ou nenhum".

**Frases sob o bloco:**

- 💾 "grava o evento junto com o pedido"
- ⏱️ "um relay publica a cada segundo"
- 🔁 "broker fora do ar? tenta de novo depois"

**Post-it:** "primeiro grava, depois publica"

### 00e — Foco: fila

**Subtítulo:** "entrega cada evento a quem se interessa"
**Bloco aceso:** 5, Fila (amarelo-manteiga). Do bloco saem três setas finas em leque
para três etiquetas pequenas: "pagamento", "loja", "entrega". Acender também as duas
setas de retorno.

**Frases sob o bloco:**

- 📬 "cada consumidor tem a sua fila"
- ⏳ "falhou? espera e tenta de novo"
- ✅ "a mesma mensagem duas vezes não estraga nada"

**Post-it:** "trocar o RabbitMQ mexe só nos adaptadores"

---

## 01 — Os eventos do pedido

Usa o mesmo *Estilo base minimalista*. Aqui o bloco **Eventos** do 00 vira o desenho
inteiro: todos os cartões são lilás (a cor dos eventos na série) e o que muda entre eles
é só o ícone.

**Título:** "Os eventos do pedido"
**Subtítulo:** "cinco fatos, do checkout à porta do cliente"

**Layout:** uma estrada desenhada à mão atravessando o desenho da esquerda para a
direita, levemente ondulada. Sobre ela, cinco cartões lilases em formato de envelope,
igualmente espaçados, numerados de 1 a 5 em pequenos círculos. Acima de cada envelope,
um ícone grande do que aconteceu. Entre um envelope e o seguinte, uma seta preta com uma
etiqueta pequena e arredondada, em cinza, dizendo quem reage àquele evento. Muito espaço
vazio acima e abaixo da estrada.

**Cartões (nome do evento em letra de mão monoespaçada, frase em letra de mão normal):**

1. Ícone de carrinho de compras com um ✓ — `order.placed` — "o cliente fechou o pedido"
2. Ícone de cartão de crédito com um ✓ — `order.payment-approved` — "o pagamento foi
   aprovado"
3. Ícone de cesta com produtos — `order.picking-started` — "a loja começou a separar os
   itens"
4. Ícone de moto de entregador — `order.out-for-delivery` — "o entregador saiu com o
   pedido"
5. Ícone de casa com um pacote na porta — `order.delivered` — "o pedido chegou ao
   cliente"

**Etiquetas nas setas entre os cartões (quem reage):**

- 1 → 2: "pagamento"
- 2 → 3: "loja"
- 3 → 4: "entrega"
- 4 → 5: "entrega"

**Fim da estrada:** depois do cartão 5, a estrada termina em uma pequena bandeira
quadriculada desenhada à mão, com o texto cinza "ninguém reage: fim da cadeia".

**Anotação roxa**, com seta tracejada apontando para os nomes dos eventos: "sempre no
passado — já aconteceu".

**Post-it:** "cada evento é o gatilho do próximo passo"

