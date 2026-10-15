## Purpose

Define a base Dart pura do app mobile do cliente Jajá: o resultado de operação sem exceções, o comando que as telas executam, as falhas tipadas com mensagem para a pessoa, o dinheiro em centavos e a configuração do endereço da API.

## ADDED Requirements

### Requirement: Resultado de operação
Toda operação que pode falhar fora da UI SHALL devolver um resultado que é exatamente um de dois casos: sucesso com o valor, ou falha com uma falha tipada do app. O conjunto de casos MUST ser fechado, de modo que um tratamento que não cubra os dois casos não compile. Nenhuma exceção MUST atravessar as camadas como forma de sinalizar falha.

#### Scenario: Sucesso carrega o valor
- **WHEN** uma operação termina bem com o valor `42`
- **THEN** o resultado é o caso de sucesso, e o valor `42` é lido por desestruturação

#### Scenario: Falha carrega a falha tipada
- **WHEN** uma operação falha por rede
- **THEN** o resultado é o caso de falha, com uma falha do tipo rede e sua mensagem

### Requirement: Falhas tipadas com mensagem para a pessoa
O app SHALL classificar falhas num conjunto fechado de tipos: validação, rede, configuração, sessão ausente ou expirada, recusa do backend, recurso não encontrado, erro do servidor e erro inesperado. Toda falha MUST ter uma mensagem em português pronta para exibir e um código que a identifica. A mensagem MUST ser um texto fixo, nunca a descrição de uma exceção nem um stack trace. A falha de recusa do backend MUST carregar o status HTTP e a lista de códigos de erro que o backend devolveu em `message`, preservando a ordem.

#### Scenario: Recusa do backend com códigos
- **WHEN** uma falha de recusa é criada para o status `400` com os códigos `CART_ITEMS_LIMIT_EXCEEDED`
- **THEN** ela expõe o status `400`, a lista `["CART_ITEMS_LIMIT_EXCEEDED"]` e uma mensagem em português

#### Scenario: Tratamento exaustivo dos tipos
- **WHEN** o código trata uma falha com um `switch` que omite um dos tipos
- **THEN** a análise estática acusa o caso não coberto

### Requirement: Comando de tela
O app SHALL oferecer um comando que executa uma ação assíncrona que devolve um resultado, com e sem argumento, e expõe se está em execução e o último resultado. Ao começar, o comando MUST marcar a execução, limpar o resultado anterior e avisar a mudança; ao terminar, MUST guardar o resultado, desmarcar a execução e avisar de novo. Uma nova execução pedida enquanto outra roda MUST ser ignorada. Se a ação lançar uma exceção, o comando MUST guardar uma falha inesperada com a mensagem "Algo deu errado. Tente novamente." em vez de propagar a exceção.

#### Scenario: Ciclo de execução
- **WHEN** o comando executa uma ação que devolve sucesso
- **THEN** ele avisa a mudança duas vezes, fica em execução sem resultado entre os avisos e termina fora de execução com o sucesso guardado

#### Scenario: Execução concorrente ignorada
- **WHEN** o comando é executado de novo antes de a primeira execução terminar
- **THEN** a ação roda uma única vez

#### Scenario: Exceção vira falha inesperada
- **WHEN** a ação lança uma exceção
- **THEN** o comando termina fora de execução com uma falha inesperada e a mensagem "Algo deu errado. Tente novamente."

### Requirement: Dinheiro em centavos
Valores monetários SHALL ser representados como um número inteiro de centavos, nunca como número de ponto flutuante. Criar um valor a partir de centavos negativos MUST resultar em falha de validação. O valor MUST suportar zero, soma de dois valores, multiplicação por uma quantidade inteira não negativa, soma de uma coleção (zero quando vazia), comparação de ordem e igualdade por centavos. A formatação para exibição MUST ficar fora do núcleo.

#### Scenario: Soma e multiplicação exatas
- **WHEN** o preço de `1290` centavos é multiplicado por `2` e somado a `490` centavos
- **THEN** o resultado é `3070` centavos

#### Scenario: Centavos negativos
- **WHEN** um valor é criado com `-1` centavo
- **THEN** o resultado é uma falha de validação

#### Scenario: Igualdade e ordem
- **WHEN** dois valores de `7900` centavos são comparados entre si e com `490` centavos
- **THEN** os dois primeiros são iguais e ambos são maiores que `490` centavos

### Requirement: Endereço da API configurável
O app SHALL obter o endereço base da API do valor `API_URL` definido na compilação (`--dart-define`). No ambiente de desenvolvimento, sem valor definido, o endereço MUST ser `http://localhost:4000`. No ambiente de produção, sem valor definido, MUST resultar em falha de configuração. Um valor que não seja um endereço `http` ou `https` absoluto com host MUST resultar em falha de configuração. Uma barra final MUST ser descartada.

#### Scenario: Padrão de desenvolvimento
- **WHEN** o endereço é resolvido no ambiente de desenvolvimento sem `API_URL`
- **THEN** o endereço é `http://localhost:4000`

#### Scenario: Valor definido na compilação
- **WHEN** o endereço é resolvido com `API_URL=http://10.0.2.2:4000/`
- **THEN** o endereço é `http://10.0.2.2:4000`

#### Scenario: Produção sem endereço
- **WHEN** o endereço é resolvido no ambiente de produção sem `API_URL`
- **THEN** o resultado é uma falha de configuração
