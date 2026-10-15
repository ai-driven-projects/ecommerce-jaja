/opsx:apply {{NOME}}

Esta sessão começa com **contexto limpo** e implementa só uma parte da change
`{{NOME}}`: o **lote {{LOTE}} de {{TOTAL_LOTES}}**, com estas tarefas do `tasks.md`:

{{TAREFAS}}

- Antes de começar, leia `proposal.md`, `design.md` e as specs da change, e veja o
  que as sessões anteriores já fizeram: as tarefas marcadas no `tasks.md` e
  `git status`/`git diff -- {{ESCOPO_ARGS}}`. Não refaça o que está pronto.
- Implemente **só as tarefas deste lote**, na ordem, marcando cada uma como
  concluída (`- [x]`) no `tasks.md` assim que terminar. Não adiante tarefas de
  outros grupos: cada lote tem a sua sessão.
- Siga a spec e o design da change. Se uma tarefa estiver ambígua, escolha a
  solução mais próxima do que o código já faz e registre no `design.md`.
- A próxima sessão não vê esta conversa: toda decisão que afete os lotes
  seguintes vai para o `design.md` ("Decisões tomadas sem consulta").
- Se descobrir que uma tarefa é inviável, ajuste a tarefa no `tasks.md`
  explicando o motivo, em vez de parar.
- Ao terminar o lote, rode as verificações ligadas ao que mudou e corrija o que
  quebrar. A verificação completa roda depois, pelo script:

{{VERIFICACOES}}
