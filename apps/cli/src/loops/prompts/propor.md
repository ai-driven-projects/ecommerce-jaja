/opsx:propose {{NOME}}

Crie a change OpenSpec `{{NOME}}` com todos os artefatos (proposal, specs,
design, tasks). Use exatamente esse nome. Ela é a etapa {{NUMERO}} de {{TOTAL}}
(fase {{FASE}}: **{{TITULO}}**) do plano do loop `{{LOOP}}` (`{{PLANO}}`) e
cobre essa etapa inteira, nem mais nem menos.

Se a change já existir (execução anterior interrompida), complete os artefatos
que faltam em vez de recriá-la.
{{BRIEFING}}
{{REGRAS_DA_SPEC}}

## Resposta

Responda com:
- `title`: frase curta para a mensagem de commit da entrega (em português, sem
  ponto final e sem prefixo como `feat:`);
- `comparison`: 3 a 6 linhas com o que você observou do ponto de partida.
