Passo **REVISAR A PROPOSTA ANTECIPADA** do loop `{{LOOP}}`: etapa {{NUMERO}} de {{TOTAL}}, change `{{NOME}}`.

A change `openspec/changes/{{NOME}}/` foi escrita enquanto a etapa anterior
(`{{ANTERIOR}}`) ainda estava sendo implementada. Agora a etapa anterior está
entregue. Confira se a proposta continua certa e ajuste **só o que ficou
desatualizado**. Não reescreva o que está certo.

1. Leia `proposal.md`, `design.md` (em especial "Dependências da etapa
   anterior"), as specs e o `tasks.md` da change.
2. Veja o que a etapa anterior entregou desde que a proposta começou:
   `git diff --stat {{BASE}} HEAD -- {{ESCOPO_ARGS}}` e, onde a change depende
   dela, o diff dos arquivos.
3. Corrija o que não bate com o código entregue: nomes de arquivos, classes,
   componentes e APIs, tarefas que já estão feitas ou ficaram inviáveis,
   requisitos que contradizem o que foi entregue. Mantenha o escopo da etapa e
   as regras de tamanho e de tarefas das changes do loop.
4. Não implemente nada. Rode `openspec validate {{NOME}} --strict` e corrija até
   passar.

Se nada precisar mudar, não altere nenhum arquivo.
