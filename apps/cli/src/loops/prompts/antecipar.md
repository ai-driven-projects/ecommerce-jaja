/opsx:propose {{NOME}}

Crie a change OpenSpec `{{NOME}}` com todos os artefatos (proposal, specs,
design, tasks). Use exatamente esse nome. Ela é a etapa {{NUMERO}} de {{TOTAL}}
(fase {{FASE}}: **{{TITULO}}**) do plano do loop `{{LOOP}}` (`{{PLANO}}`) e
cobre essa etapa inteira, nem mais nem menos.

## Esta proposta é antecipada

Ela roda **em paralelo** à implementação da etapa anterior, a change
`{{ANTERIOR}}` (`openspec/changes/{{ANTERIOR}}/`), que outra sessão está
aplicando no código agora.

- Considere a etapa anterior entregue como a change dela descreve (proposal,
  design, specs e tasks). O código dessa área está em obras: não o use como ponto
  de partida e não se baseie em arquivos pela metade.
- Escreva **somente** em `openspec/changes/{{NOME}}/`. Não edite código e não
  rode build, codegen, testes, formatadores nem nada que escreva fora dessa
  pasta: isso atrapalharia a outra sessão.
- Antes de aplicar esta change, o loop a revisa contra o código já entregue.
  Para isso, registre no `design.md`, numa seção "Dependências da etapa
  anterior", o que você assumiu sobre ela (arquivos, componentes, APIs).

{{REGRAS_DA_SPEC}}

## Resposta

Responda com:
- `title`: frase curta para a mensagem de commit da entrega (em português, sem
  ponto final e sem prefixo como `feat:`);
- `comparison`: 3 a 6 linhas com o que você observou do ponto de partida.
