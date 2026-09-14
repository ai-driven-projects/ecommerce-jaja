## MODIFIED Requirements

### Requirement: Catálogo com dados locais
Nesta entrega a vitrine SHALL usar um catálogo local (sem chamadas à API) com as categorias `papelaria`, `impressão`, `café e lanches`, `limpeza de escritório` e `tecnologia básica`, ao menos 16 produtos distribuídos entre elas, cada um com identificador de URL único, nome, categoria, preço em centavos e unidade de venda, e os bairros atendidos agrupados por loja com tempo estimado de entrega em minutos.

#### Scenario: Catálogo carregado
- **WHEN** a vitrine é exibida para um bairro atendido com a categoria "todas"
- **THEN** ao menos 16 produtos são exibidos e cada categoria tem ao menos um produto

### Requirement: Bairro não atendido
Quando o bairro selecionado não pertencer a nenhuma loja, a vitrine SHALL ocultar filtros e grade e exibir o estado vazio: o título em display "Ainda não chegamos aí. Já já." com o ponto final em vermelho, o texto "Por enquanto atendemos:" e a lista dos bairros atendidos agrupados por loja (nome da loja em caixa alta com régua de 2px), cada bairro clicável. O cabeçalho MUST omitir o ETA. Os bairros não atendidos `Papicu`, `Montese` e `Messejana` MUST constar no seletor para permitir esse fluxo.

#### Scenario: Bairro fora da área
- **WHEN** o visitante acessa `/?bairro=Papicu`
- **THEN** nenhum produto é exibido, o título "Ainda não chegamos aí. Já já." aparece com o ponto em vermelho e os bairros atendidos aparecem agrupados por loja

#### Scenario: Escolher bairro atendido pelo estado vazio
- **WHEN** no estado vazio o visitante clica em "Aldeota"
- **THEN** a URL passa a conter `bairro=Aldeota` e a grade de produtos volta a ser exibida
