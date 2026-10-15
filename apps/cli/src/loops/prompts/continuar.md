/opsx:apply {{NOME}}

Esta sessão começa com **contexto limpo**. A implementação da change `{{NOME}}`
parou com tarefas ainda abertas no `tasks.md`:

{{PENDENTES}}

Leia `proposal.md`, `design.md` e as specs da change, veja o que já está feito
(tarefas marcadas, `git diff -- {{ESCOPO_ARGS}}`) e conclua só as tarefas
restantes, marcando cada uma com `- [x]`. Se alguma for inviável, ajuste a tarefa
explicando o motivo. Termine com estas verificações passando:

{{VERIFICACOES}}
