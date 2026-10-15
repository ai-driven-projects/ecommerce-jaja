## MODIFIED Requirements

### Requirement: Falhas tipadas com mensagem para a pessoa
O app SHALL classificar falhas num conjunto fechado de tipos: validação, rede, configuração, sessão ausente ou expirada, recusa do backend, recurso não encontrado, erro do servidor e erro inesperado. Toda falha MUST ter uma mensagem em português pronta para exibir e um código que a identifica. A mensagem MUST ser um texto fixo, nunca a descrição de uma exceção nem um stack trace. A falha de recusa do backend MUST carregar o status HTTP e a lista de códigos de erro que o backend devolveu em `message`, preservando a ordem. A falha inesperada MUST usar sempre a mesma mensagem, "Algo deu errado. Tente novamente.", declarada uma única vez no núcleo, venha ela de um comando de tela, de uma chamada à API ou de um estado inesperado num ViewModel.

#### Scenario: Recusa do backend com códigos
- **WHEN** uma falha de recusa é criada para o status `400` com os códigos `CART_ITEMS_LIMIT_EXCEEDED`
- **THEN** ela expõe o status `400`, a lista `["CART_ITEMS_LIMIT_EXCEEDED"]` e uma mensagem em português

#### Scenario: Tratamento exaustivo dos tipos
- **WHEN** o código trata uma falha com um `switch` que omite um dos tipos
- **THEN** a análise estática acusa o caso não coberto

#### Scenario: Mesma mensagem para o inesperado
- **WHEN** um comando de tela lança uma exceção e, em outro momento, a conversão de uma resposta da API falha
- **THEN** as duas falhas são inesperadas e têm a mensagem "Algo deu errado. Tente novamente."
