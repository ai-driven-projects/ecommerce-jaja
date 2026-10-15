Você vai preparar um **loop automático de desenvolvimento** chamado `{{NOME}}`.

Não altere nenhum arquivo: apenas leia e analise o repositório.

As etapas deste loop já estão decididas: são changes OpenSpec que **já existem**
em `openspec/changes/`, escolhidas pelo usuário nesta ordem (uma etapa por
change, sem proposta nova: o loop vai direto aplicar, verificar, arquivar e
commitar cada uma):

{{SPECS}}

Faça assim:

1. Leia o `proposal.md`, o `design.md` (se houver) e o `tasks.md` de cada change,
   o `README.md` da raiz e os dos apps e pacotes que elas tocam (e o `CLAUDE.md`
   ou `AGENTS.md`, se existirem).
2. Descubra os comandos que provam que o código continua certo (build, lint,
   checagem de tipos, testes) e a pasta de onde cada um roda. Prefira os scripts
   que o próprio projeto usa (`package.json` de cada workspace, `turbo.json`, CI),
   por exemplo `npm run check-types`, `npm run lint` e `npm run test` dentro do
   app, ou `npx turbo run test --filter=<pacote>` na raiz.
3. Não mude a ordem, não junte, não divida e não acrescente etapas.

Responda com:
- `title`: nome curto do loop, em português;
- `goal`: 2 a 4 frases com o que o loop entrega no conjunto;
- `rules`: regras específicas deste loop, em markdown, para o agente seguir em
  todas as sessões (arquitetura, referências, convenções, pacotes permitidos, o
  que não tocar). Não repita regras gerais de autonomia;
- `outOfScope`: o que fica fora de todas as etapas, em markdown;
- `stages`: uma por change, com `change` (o nome exato), `title` (curto) e
  `description` (1 a 2 linhas com o que a change entrega);
- `scope`: as pastas que o loop pode alterar e commitar (ex.: `apps/backend`),
  relativas à raiz;
- `commitPrefix`: prefixo dos commits de entrega (ex.: `feat(backend)`);
- `requiredCommands`: executáveis além de `claude`, `openspec` e `git` que precisam
  estar no PATH (ex.: `docker`);
- `checks`: lista com `label`, `command` (o comando completo, sem `cd`) e
  `dir` (relativa à raiz).
