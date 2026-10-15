## Ponto de partida

Leia só o que a etapa toca, não o projeto inteiro:

- o plano (`{{PLANO}}`): o objetivo, o texto da etapa {{NUMERO}} e a seção
  "Fora do escopo";
- o código que a etapa substitui ou estende e os arquivos que servem de
  referência de comportamento e de estilo;
- as specs principais das capacidades envolvidas, em `openspec/specs/`: elas já
  consolidam o que as etapas anteriores entregaram;
- como modelo de formato, só a change arquivada mais recente do loop:
  {{REFERENCIA}}. Não leia as outras changes arquivadas inteiras; se precisar de
  uma decisão específica, procure com `grep` em `openspec/changes/archive/`.

Etapas já entregues pelo loop:

{{ENTREGUES}}

## Tamanho

Seja enxuto: tudo o que você escrever é relido em todas as sessões do apply.
A change inteira (proposal, design, specs e tasks) deve ficar em torno de
**{{TAMANHO}} mil caracteres**.

- `proposal.md`: o porquê e o quê em poucos parágrafos, mais a lista de impactos.
  Sem repetir o design.
- `design.md`: só as decisões e o que não é óbvio no código, inclusive
  "Decisões tomadas sem consulta" e o que fica para outras etapas. Sem trechos
  longos de código e sem a lista de arquivos que o `tasks.md` já tem.
- specs: requisitos observáveis, com 1 a 3 cenários essenciais cada. Detalhe de
  implementação (classes, arquivos) fica no design. Em `MODIFIED`, copie o
  requisito inteiro, como o OpenSpec exige, mas só dos requisitos que a etapa
  realmente muda.

## Tarefas

- As tarefas precisam ser executáveis por um agente sem ajuda humana, cada uma
  pequena e verificável. **Cada tarefa tem de 1 a 3 linhas**: o quê, onde e como
  verificar. O porquê e os detalhes ficam no `design.md`.
- Organize as tarefas em grupos numerados (`## 1. …`), coesos e com **até 8
  tarefas** cada: o apply roda um lote de grupos por sessão, com contexto limpo,
  então um grupo precisa fazer sentido sozinho para quem só leu proposal, design
  e specs. Inclua tarefas de testes para as regras novas e uma tarefa final de
  verificação com estes comandos:

{{VERIFICACOES}}

- Nada de tarefas que dependam de pessoas (revisão visual manual, aprovação,
  deploy). Verificação visual vira teste ou fica registrada como fora do escopo.

## Limites da etapa

- Não divida a etapa em mais de uma change nem puxe trabalho de outra etapa do
  plano: o que for de outra etapa fica registrado no `design.md`.
- Registre no `design.md` as decisões tomadas sem consulta.
- Não implemente nada: só os artefatos da change. Ao final, rode
  `openspec validate {{NOME}} --strict` e corrija até passar.
