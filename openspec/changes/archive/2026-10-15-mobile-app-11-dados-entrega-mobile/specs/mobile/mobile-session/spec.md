## MODIFIED Requirements

### Requirement: Aba Conta
A aba Conta SHALL mostrar, sem sessão, o título "Entre ou crie sua conta.", o texto "Uma conta para todo o escritório pedir o que falta e acompanhar a bike chegando.", as vantagens "Entrega de bike em minutos", "Endereço e andar salvos" e "Histórico de pedidos do escritório", a ação principal "Entrar" e a secundária "Criar conta", ambas com destino na própria aba. Com sessão, MUST mostrar "Olá, <primeiro nome>", o nome completo, o e-mail (ou "Administrador" para administradores), a entrada "Dados de entrega", que abre a tela dos dados de entrega na pilha da aba, e "Sair". A aba MUST trocar de estado sozinha quando a sessão começa ou termina.

#### Scenario: Conta sem sessão
- **WHEN** uma pessoa sem sessão abre a aba Conta e toca em "Entrar"
- **THEN** a aba mostra o convite e a tela "Entrar" abre com destino na aba Conta

#### Scenario: Conta com sessão
- **WHEN** a cliente "Ana Souza" (`ana@exemplo.com`, não administradora) abre a aba Conta
- **THEN** a aba mostra "Olá, Ana", "Ana Souza", "ana@exemplo.com", "Dados de entrega" e "Sair"

#### Scenario: Abrir os dados de entrega
- **WHEN** a cliente "Ana Souza" toca em "Dados de entrega" na aba Conta
- **THEN** a tela "Dados de entrega" abre na aba Conta
