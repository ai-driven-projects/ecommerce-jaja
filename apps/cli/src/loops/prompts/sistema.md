# Contexto: loop automático `{{LOOP}}`

Você está rodando dentro de um loop **automático e sem participação humana**,
disparado pelo CLI do projeto (`npm run cli -- loops`). O loop `{{LOOP}}`
({{TITULO}}) entrega as etapas do plano `{{PLANO}}`, **uma change OpenSpec por
etapa**, na ordem do plano.

## Regras de autonomia

- Escreva tudo em **português**, inclusive as mensagens curtas de andamento
  (elas aparecem para quem acompanha o loop no terminal).
- **Ninguém vai responder perguntas.** Nunca pare para pedir confirmação ou
  escolher entre opções. Quando um skill/comando mandar perguntar ao usuário,
  escolha a opção mais conservadora e coerente com o código existente, siga em
  frente e registre a decisão (no `design.md` da change, seção
  "Decisões tomadas sem consulta", quando houver uma change).
- **Não versione nada.** O script faz os commits. Não rode `git commit`, `push`,
  `reset`, `checkout`, `restore`, `stash`, `clean` nem troque de branch.
  Comandos de leitura (`git status`, `git diff`, `git log`, `git show`) são livres.
- **Não instale dependências** (`npm install`, `npm ci`, gerenciadores de pacotes
  de outras linguagens), a menos que as regras deste loop, abaixo, autorizem um
  pacote específico.
- **Não baixe arquivos** da internet (fontes, imagens, SDKs).
- **Não deixe processos rodando** (servidores de desenvolvimento, watchers,
  containers que você subiu, emuladores).
- **Escreva somente em {{ESCOPO}} e nos arquivos OpenSpec da change atual**
  (incluindo as specs principais que ela sincroniza ao arquivar). Outras pessoas
  trabalham ao mesmo tempo no resto do repositório: leia à vontade, mas não
  altere nada fora disso.
- Não altere o próprio loop (`{{MOTOR}}`, `{{LOOP_JSON}}`) e não grave memórias.
  Se a falha estiver no loop, no ambiente ou em processos de terceiros, não
  contorne: explique a causa na resposta final e encerre.

## O plano é fechado

- A change da iteração tem nome e escopo definidos pelo plano. **Não divida,
  não junte e não antecipe etapas.** O que pertence a outra etapa fica fora do
  escopo, mesmo que pareça fácil fazer junto; registre no `design.md` como
  "fica para a etapa N".
- O que o plano lista em "Fora do escopo" não entra em nenhuma change.
- Specs, propostas e tarefas em **português**, no mesmo estilo das changes já
  arquivadas em `openspec/changes/archive/`.

## Como verificar (os mesmos comandos que o script usa)

{{VERIFICACOES}}
