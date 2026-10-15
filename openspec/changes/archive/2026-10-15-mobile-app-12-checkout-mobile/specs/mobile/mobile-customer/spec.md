## MODIFIED Requirements

### Requirement: Acesso aos dados de entrega
A tela "Dados de entrega" SHALL abrir pela aba Conta, na pilha da própria aba, com a barra de abas visível, e MUST exigir sessão. Ela MUST abrir também pelo checkout ("Preencher dados de entrega" ou "Alterar"), na pilha do checkout na aba Carrinho. Aberta pelo checkout, salvar com sucesso MUST voltar ao checkout. Aberta pela aba Conta, a tela continua aberta depois de salvar. Sem sessão, abrir a tela MUST levar a "Entrar" com a tela como destino, e entrar MUST voltar para ela. Se a sessão expirar (`401`) com a tela aberta, o app MUST ir para "Entrar" com a tela como destino.

#### Scenario: Abrir pela aba Conta
- **WHEN** a cliente "Ana Souza" com sessão toca em "Dados de entrega" na aba Conta
- **THEN** a tela "Dados de entrega" abre na aba Conta, com a barra de abas visível

#### Scenario: Sem sessão
- **WHEN** uma pessoa sem sessão chega à rota dos dados de entrega e entra com credenciais válidas
- **THEN** a tela "Entrar" abre primeiro e, depois de entrar, a tela "Dados de entrega" aparece

#### Scenario: Aberta pelo checkout
- **WHEN** no checkout o cliente toca em "Alterar", muda o número e toca em "Salvar dados" com sucesso
- **THEN** o app volta ao checkout, com a aba Carrinho selecionada, e o resumo do endereço mostra o número novo
