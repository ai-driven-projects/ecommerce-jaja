## ADDED Requirements

### Requirement: Fechar pedido leva ao checkout
O botão "Fechar pedido" da sacola SHALL fechar o painel da sacola e navegar para `/checkout` preservando os parâmetros `bairro` e `categoria` da vitrine. A navegação MUST NOT depender de sessão: quem não estiver autenticado é identificado na própria página de checkout. Nesta entrega a sacola continua sem itens e o painel só exibe "Fechar pedido" quando há itens; o comportamento SHALL valer assim que houver itens na sacola.

#### Scenario: Fechar pedido com bairro e categoria
- **WHEN** um visitante em `/?bairro=Meireles&categoria=papelaria` clica em "Fechar pedido" na sacola
- **THEN** o painel da sacola fecha e a página passa a `/checkout?bairro=Meireles&categoria=papelaria`

#### Scenario: Fechar pedido sem sessão
- **WHEN** um visitante sem sessão clica em "Fechar pedido"
- **THEN** chega a `/checkout` e vê o formulário de entrar/criar conta, sem ser redirecionado para `/entrar`
