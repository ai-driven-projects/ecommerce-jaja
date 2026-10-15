Você vai planejar um **loop automático de desenvolvimento** chamado `{{NOME}}`.

Não altere nenhum arquivo: apenas leia e analise o repositório.

Um loop entrega um objetivo em etapas, **uma change OpenSpec por etapa**, sem
participação humana: em cada iteração um agente estuda a etapa, propõe a
change, implementa, verifica (build, lint, tipos, testes), arquiva e commita.
Cada sessão começa com contexto limpo, então cada etapa precisa fazer sentido
sozinha e caber numa change de tamanho razoável (até umas 40 tarefas pequenas).

Objetivo do loop, escrito pelo usuário:

{{OBJETIVO}}

Faça assim:

1. Leia o `README.md` da raiz e os dos apps, módulos e pacotes envolvidos (e o
   `CLAUDE.md` ou `AGENTS.md`, se existirem), a estrutura das pastas que o
   objetivo toca, as changes arquivadas recentes (`openspec/changes/archive/`) e
   as specs (`openspec/specs/`) relacionadas.
2. Descubra o ponto de partida: o que já existe, o que falta, o que serve de
   referência.
3. Divida o objetivo em **fases** (2 a 5) e **etapas** (em geral 3 a 20), em ordem
   de dependência: fundamentos primeiro, varredura e limpeza por último.
4. Descubra os comandos que provam que o código continua certo (build, lint,
   checagem de tipos, testes) e a pasta de onde cada um roda. Prefira os scripts
   que o próprio projeto usa (`package.json` de cada workspace, `turbo.json`, CI),
   por exemplo `npm run check-types`, `npm run lint` e `npm run test` dentro do
   app, ou `npx turbo run test --filter=<pacote>` na raiz.

Responda com:
- `title`: nome curto do loop, em português;
- `rules`: regras específicas deste loop, em markdown, para o agente seguir em
  todas as sessões (arquitetura, referências, convenções, pacotes permitidos, o
  que não tocar). Não repita regras gerais de autonomia;
- `outOfScope`: o que fica fora de todas as etapas, em markdown;
- `phases`: cada uma com `name` e `stages`; cada etapa com `title` (curto),
  `subject` (2 a 4 palavras em kebab-case, sem acentos, que vira o nome da change)
  e `description` (2 a 5 linhas: o que a etapa entrega, referências e limites);
- `scope`: as pastas que o loop pode alterar e commitar (ex.: `apps/backend`,
  `modules/orders`), relativas à raiz;
- `commitPrefix`: prefixo dos commits de entrega (ex.: `feat(backend)`);
- `requiredCommands`: executáveis além de `claude`, `openspec` e `git` que precisam
  estar no PATH (ex.: `docker`);
- `checks`: lista com `label`, `command` (o comando completo, sem `cd`) e
  `dir` (relativa à raiz).
