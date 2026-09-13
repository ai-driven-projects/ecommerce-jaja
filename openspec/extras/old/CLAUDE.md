# Já Já — instruções permanentes

Projeto DIDÁTICO para ensinar arquitetura orientada a eventos. "Já Já" é um
e-commerce hiperlocal que entrega material de escritório e lanches em regiões
comerciais de Fortaleza, de bike ou a pé, saindo de pequenos hubs. Não é
produto real.

**Antes de qualquer mudança, leia `docs/design.md` (toda tela segue esse doc
à risca) e `docs/eventos.md` (mapa de eventos do sistema).**

## Stack (monorepo pnpm)
- `apps/web` — Vite + React + TypeScript. CSS Modules com as variáveis de
  docs/design.md. Sem Tailwind, sem lib de componentes.
- `apps/runner` — processo único de dev que cria UM EventBus em memória e
  sobe todos os serviços com ele, cada um na sua porta.
- `services/catalogo` (:3001), `services/pedidos` (:3002),
  `services/pagamentos` (:3003), `services/estoque` (:3004),
  `services/entregas` (:3005), `services/notificacoes` (:3006) — Node 20 +
  Fastify + TypeScript + better-sqlite3. Cada serviço tem seu próprio arquivo
  SQLite (nunca compartilhado) e exporta `createService({ bus, dbPath, port })`.
- `packages/contratos` — tipos e schemas (zod) dos eventos do sistema.
- `packages/broker` — interface `EventBus { publish, subscribe }` com adapter
  em memória. Um adapter RabbitMQ virá depois; a interface não pode vazar
  detalhes de nenhum broker.
- `docker-compose.yml` — placeholder comentado por enquanto.

## Runner (dev)
Em dev, os serviços rodam juntos como um monólito modular compartilhando o
bus em memória. O broker real e a separação em processos vêm no prompt 5.
Isso é proposital e vai ser usado em aula para comparar as duas formas.
O front nunca conhece portas: o Vite faz proxy de `/api/catalogo` e
`/api/pedidos` para as portas certas.

## Regras de arquitetura
- Eventos em português, formato `contexto.evento_no_passado`
  (ex.: `pedido.criado`, `pagamento.aprovado`). Sempre fato consumado,
  nunca comando.
- Serviços só se comunicam por eventos. Única exceção: consultas síncronas
  de leitura (zona de entrega, catálogo, preço), sempre documentadas como tal.
- Todo evento carrega: `id` (uuid), `tipo`, `ocorridoEm` (ISO), `pedidoId`
  quando houver, e payload tipado em `packages/contratos`.
- Cada serviço é dono dos seus dados. Outro serviço nunca lê seu banco.

## Tempos simulados
Todos os atrasos das simulações leem a env `JAJA_ESCALA_TEMPO` (padrão 1) e
multiplicam por ela: reserva 1s, separação 4s, atribuição 2s, "chegando" 8s
depois de a_caminho, "concluída" 5s depois de chegando. Com
`JAJA_ESCALA_TEMPO=0.2` o fluxo inteiro roda em ~4s para demonstrações.
