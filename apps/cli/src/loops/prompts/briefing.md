Passo **PREPARAR O BRIEFING** do loop `{{LOOP}}` (iteração {{ITERACAO}}).

Não altere nenhum arquivo neste passo: apenas leia e analise.

A etapa da vez já está decidida pelo plano — não escolha outra:

- **Etapa {{NUMERO}} de {{TOTAL}}** · fase {{FASE}}
- **{{TITULO}}** · change `{{NOME}}`

1. Leia o plano em `{{PLANO}}`, em especial o objetivo, o texto da etapa
   {{NUMERO}} e a seção "Fora do escopo".
2. Veja o que o loop já entregou:
   - as specs principais das capacidades envolvidas, em `openspec/specs/`: elas
     já consolidam o que as etapas anteriores entregaram. Não leia as changes
     arquivadas inteiras; para saber o que uma delas deixou para depois, procure
     com `grep` em `openspec/changes/archive/`;
   - etapas entregues:

{{ENTREGUES}}

3. Compare o ponto de partida desta etapa no código: o que já existe, o que esta
   etapa substitui, o que precisa ser removido e quais arquivos servem de
   referência de comportamento e de estilo.
4. Escreva a `description` como um briefing completo para quem vai criar a spec
   sem ver esta conversa: o que mudar, quais arquivos servem de referência, quais
   serão criados, alterados ou apagados, o que fica fora do escopo (inclusive o
   que é de outra etapa do plano) e como testar.

Responda com:
- `title`: frase curta para a mensagem de commit (em português, sem ponto final
  e sem prefixo como `feat:`);
- `comparison`: 3 a 6 linhas com o que você observou do ponto de partida;
- `description`: o briefing da change.
