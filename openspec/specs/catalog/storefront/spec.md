# Vitrine (Storefront) Specification

## Purpose

Define o comportamento da vitrine pública do Jaja na rota `/`: como o visitante escolhe bairro e categoria, o que vê quando o bairro é atendido ou não, como a sacola se comporta nesta entrega e como chega ao detalhe do produto.

## Requirements

### Requirement: Vitrine na rota raiz
O sistema SHALL servir a vitrine pública na rota `/`, sem exigir sessão, dentro do shell da loja (cabeçalho com logo, bairro, ETA e sacola). O redirect anterior de `/` para `/principal` MUST deixar de existir. A área administrativa MUST viver em `/admin` e exigir sessão de administrador; a rota `/principal` MUST deixar de existir. O título do documento MUST ser "já já.".

#### Scenario: Acesso anônimo à raiz
- **WHEN** um visitante sem sessão acessa `/`
- **THEN** a vitrine é exibida com o cabeçalho da loja e o título do documento "já já."

#### Scenario: Área privada preservada
- **WHEN** um administrador autenticado acessa `/admin`
- **THEN** o dashboard administrativo é exibido no shell administrativo, e `/principal` responde com a página não encontrada

### Requirement: Catálogo com dados locais
Nesta entrega a vitrine SHALL usar um catálogo local (sem chamadas à API) com as categorias `papelaria`, `impressão`, `café e lanches`, `limpeza de escritório` e `tecnologia básica`, ao menos 16 produtos distribuídos entre elas, cada um com identificador de URL único, nome, categoria, preço em centavos e unidade de venda, e os bairros atendidos agrupados por hub com tempo estimado de entrega em minutos.

#### Scenario: Catálogo carregado
- **WHEN** a vitrine é exibida para um bairro atendido com a categoria "todas"
- **THEN** ao menos 16 produtos são exibidos e cada categoria tem ao menos um produto

### Requirement: Bairro e categoria na URL
O bairro e a categoria selecionados SHALL ser lidos dos parâmetros de query `bairro` e `categoria`, com padrões "Aldeota" e "todas". Trocar o bairro no cabeçalho ou a categoria nos filtros MUST atualizar a URL sem adicionar entrada ao histórico e sem recarregar a página. Recarregar a página MUST preservar a seleção.

#### Scenario: URL sem parâmetros
- **WHEN** o visitante acessa `/`
- **THEN** o bairro exibido é "Aldeota" e o filtro ativo é "todas"

#### Scenario: Filtro por categoria
- **WHEN** o visitante clica no filtro "papelaria"
- **THEN** a URL passa a conter `categoria=papelaria`, apenas produtos de papelaria são exibidos e o filtro "papelaria" fica ativo

#### Scenario: Recarga com parâmetros
- **WHEN** o visitante acessa `/?bairro=Meireles&categoria=impressão`
- **THEN** o seletor mostra "Meireles", só produtos de impressão aparecem e o ETA de Meireles é exibido

#### Scenario: Troca de bairro
- **WHEN** o visitante escolhe "Cocó" no seletor
- **THEN** a URL passa a conter `bairro=Cocó`, o ETA exibido é o de Cocó e a categoria selecionada é mantida

### Requirement: Bairro não atendido
Quando o bairro selecionado não pertencer a nenhum hub, a vitrine SHALL ocultar filtros e grade e exibir o estado vazio: o título em display "Ainda não chegamos aí. Já já." com o ponto final em vermelho, o texto "Por enquanto atendemos:" e a lista dos bairros atendidos agrupados por hub (nome do hub em caixa alta com régua de 2px), cada bairro clicável. O cabeçalho MUST omitir o ETA. Os bairros não atendidos `Papicu`, `Montese` e `Messejana` MUST constar no seletor para permitir esse fluxo.

#### Scenario: Bairro fora da área
- **WHEN** o visitante acessa `/?bairro=Papicu`
- **THEN** nenhum produto é exibido, o título "Ainda não chegamos aí. Já já." aparece com o ponto em vermelho e os bairros atendidos aparecem agrupados por hub

#### Scenario: Escolher bairro atendido pelo estado vazio
- **WHEN** no estado vazio o visitante clica em "Aldeota"
- **THEN** a URL passa a conter `bairro=Aldeota` e a grade de produtos volta a ser exibida

### Requirement: Sacola vazia nesta entrega
O botão da sacola no cabeçalho SHALL exibir o contador "0" e abrir o painel da sacola no estado vazio. Nenhuma ação da vitrine MUST adicionar itens à sacola nesta entrega, e nada MUST ser persistido no navegador.

#### Scenario: Abrir a sacola
- **WHEN** o visitante clica no botão da sacola
- **THEN** o painel abre exibindo "Sua sacola está vazia. Já já enche."

#### Scenario: Recarga da página
- **WHEN** o visitante recarrega a vitrine
- **THEN** o contador da sacola continua em "0"

### Requirement: Navegação para o detalhe do produto
Cada card da grade SHALL ser um link para `/p/<identificador>` que preserva os parâmetros `bairro` e `categoria` atuais. A rota `/p/<identificador>` SHALL manter o cabeçalho da loja (logo, bairro, ETA e sacola) e o rodapé compartilhados, e exibir um placeholder com o caminho "vitrine / <categoria> / <nome>", em que "vitrine" volta para `/` preservando os mesmos parâmetros, o nome do produto em fonte display, o preço em mono e a frase "Detalhe do produto chega já já.". Um identificador inexistente MUST resultar na página não encontrada.

#### Scenario: Clique no card
- **WHEN** o visitante em `/?bairro=Aldeota&categoria=papelaria` clica no card de um caderno
- **THEN** navega para `/p/<slug-do-caderno>?bairro=Aldeota&categoria=papelaria`, continua vendo o cabeçalho da loja com "Aldeota" e a sacola, e vê o nome do caderno, seu preço e a frase "Detalhe do produto chega já já."

#### Scenario: Voltar pela trilha
- **WHEN** no placeholder o visitante clica em "vitrine"
- **THEN** volta para `/?bairro=Aldeota&categoria=papelaria` com o mesmo bairro e filtro

#### Scenario: Produto inexistente
- **WHEN** o visitante acessa `/p/nao-existe`
- **THEN** a resposta é a página não encontrada

### Requirement: Fechar pedido leva ao checkout
O botão "Fechar pedido" da sacola SHALL fechar o painel da sacola e navegar para `/checkout` preservando os parâmetros `bairro` e `categoria` da vitrine. A navegação MUST NOT depender de sessão: quem não estiver autenticado é identificado na própria página de checkout. Nesta entrega a sacola continua sem itens e o painel só exibe "Fechar pedido" quando há itens; o comportamento SHALL valer assim que houver itens na sacola.

#### Scenario: Fechar pedido com bairro e categoria
- **WHEN** um visitante em `/?bairro=Meireles&categoria=papelaria` clica em "Fechar pedido" na sacola
- **THEN** o painel da sacola fecha e a página passa a `/checkout?bairro=Meireles&categoria=papelaria`

#### Scenario: Fechar pedido sem sessão
- **WHEN** um visitante sem sessão clica em "Fechar pedido"
- **THEN** chega a `/checkout` e vê o formulário de entrar/criar conta, sem ser redirecionado para `/entrar`
