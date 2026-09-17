## MODIFIED Requirements

### Requirement: Retorno à página de origem
O botão "Entrar" do cabeçalho SHALL levar a `/entrar` com o parâmetro `voltar` contendo o caminho e a query da página atual, incluindo a loja escolhida. Após entrar ou criar conta, o sistema MUST exibir uma confirmação com o primeiro nome do cliente e voltar para o caminho de `voltar`; sem `voltar` MUST voltar para `/`. Só caminhos relativos iniciados por `/` MUST ser aceitos; qualquer outro valor MUST ser tratado como ausente. Um cliente que já tem sessão ao abrir `/entrar` MUST ser levado imediatamente ao destino de `voltar`.

#### Scenario: Login com retorno
- **WHEN** o visitante clica em "Entrar" na vitrine em `/?loja=loja-rio-branco&categoria=papelaria` e entra com credenciais válidas
- **THEN** vê a confirmação com seu primeiro nome e volta para `/?loja=loja-rio-branco&categoria=papelaria` já autenticado

#### Scenario: Retorno externo ignorado
- **WHEN** o visitante abre `/entrar?voltar=https://exemplo.com` e entra
- **THEN** volta para `/`

#### Scenario: Já autenticado
- **WHEN** um cliente com sessão acessa `/entrar?voltar=/p/caderno`
- **THEN** é levado para `/p/caderno` sem ver o formulário
