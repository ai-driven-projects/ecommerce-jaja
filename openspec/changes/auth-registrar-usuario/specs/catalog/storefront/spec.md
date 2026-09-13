## MODIFIED Requirements

### Requirement: Vitrine na rota raiz
O sistema SHALL servir a vitrine pública na rota `/`, sem exigir sessão, dentro do shell da loja (cabeçalho com logo, bairro, ETA e sacola). O redirect anterior de `/` para `/principal` MUST deixar de existir. A área administrativa MUST viver em `/admin` e exigir sessão de administrador; a rota `/principal` MUST deixar de existir. O título do documento MUST ser "já já.".

#### Scenario: Acesso anônimo à raiz
- **WHEN** um visitante sem sessão acessa `/`
- **THEN** a vitrine é exibida com o cabeçalho da loja e o título do documento "já já."

#### Scenario: Área privada preservada
- **WHEN** um administrador autenticado acessa `/admin`
- **THEN** o dashboard administrativo é exibido no shell administrativo, e `/principal` responde com a página não encontrada
