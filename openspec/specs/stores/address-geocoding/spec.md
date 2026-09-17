# Geocodificação de Endereços (Address Geocoding) Specification

## Purpose

Define a busca de coordenadas a partir de um endereço (`GET /geocoding`) e a sugestão de endereço a partir de um ponto do mapa (`GET /geocoding/reverse`), usadas pelo cadastro de lojas e pela página "Minha conta": ambas exigem apenas um usuário autenticado, usam o provedor de mapas quando a chave do servidor está configurada, respondem de forma simulada quando não está, e a chave nunca sai do servidor.
## Requirements
### Requirement: Localizar coordenadas de um endereço
O sistema SHALL expor `GET /geocoding?address=<texto>`. O endereço MUST ter os espaços das pontas removidos, e um endereço ausente ou com menos de 3 caracteres MUST responder `400` com `[GEOCODING_ADDRESS_REQUIRED]`. Em sucesso, MUST responder `200` com `{ latitude, longitude, formattedAddress, source }`, com as coordenadas arredondadas para 6 casas decimais e `source` igual a `"google"` ou `"mock"`. Quando o provedor não encontrar o endereço, MUST responder `404` com `[GEOCODING_ADDRESS_NOT_FOUND]`. Quando o provedor estiver indisponível, MUST responder `503` com `[GEOCODING_UNAVAILABLE]`. Isso inclui chave recusada, cota excedida, erro de rede e ausência de resposta em 5 segundos. O endpoint MUST NOT criar nem alterar lojas.

#### Scenario: Endereço vazio
- **WHEN** um administrador chama `GET /geocoding?address=%20%20`
- **THEN** o sistema responde `400` com `GEOCODING_ADDRESS_REQUIRED`

#### Scenario: Endereço encontrado pelo provedor
- **WHEN** a chave do servidor está configurada e um administrador chama `GET /geocoding?address=Avenida Paulista, 1578, São Paulo`
- **THEN** o sistema responde `200` com `source: "google"`, latitude entre −23,57 e −23,55, longitude entre −46,67 e −46,64 e o endereço formatado pelo provedor

#### Scenario: Endereço não encontrado
- **WHEN** a chave do servidor está configurada e o provedor não encontra nenhum resultado para o endereço informado
- **THEN** o sistema responde `404` com `GEOCODING_ADDRESS_NOT_FOUND`

#### Scenario: Provedor indisponível
- **WHEN** a chave do servidor está configurada e o provedor responde com erro de autorização ou não responde em 5 segundos
- **THEN** o sistema responde `503` com `GEOCODING_UNAVAILABLE`

### Requirement: Geocodificação simulada sem chave do servidor
Quando a chave do provedor não estiver configurada no servidor, a geocodificação SHALL ser simulada, sem chamar nenhum serviço externo:
- `GET /geocoding` responde a qualquer endereço válido com `200` e sempre o mesmo ponto: `latitude: -23.561414`, `longitude: -46.655881`, `formattedAddress: "Avenida Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200"` e `source: "mock"`;
- `GET /geocoding/reverse` responde a qualquer ponto válido com `200`, o ponto consultado arredondado para 6 casas e sempre o mesmo endereço: `formattedAddress: "Avenida Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200"`, `zipCode: "01310200"`, `street: "Avenida Paulista"`, `number: "1578"`, `neighborhood: "Bela Vista"`, `city: "São Paulo"`, `state: "SP"` e `source: "mock"`. Um ponto inválido MUST responder `400` com `GEOCODING_LOCATION_INVALID`.

O servidor MUST registrar na inicialização um aviso de que a geocodificação está simulada.

#### Scenario: Endereço de Fortaleza sem chave
- **WHEN** a chave do servidor não está configurada e um usuário autenticado chama `GET /geocoding?address=Rua Silva Paulet, 1100, Fortaleza`
- **THEN** o sistema responde `200` com `source: "mock"`, `latitude: -23.561414`, `longitude: -46.655881` e o endereço da Avenida Paulista

#### Scenario: Ponto no Rio de Janeiro sem chave
- **WHEN** a chave do servidor não está configurada e um usuário autenticado chama `GET /geocoding/reverse?latitude=-22.9068471&longitude=-43.1728969`
- **THEN** o sistema responde `200` com `latitude: -22.906847`, `longitude: -43.172897`, `source: "mock"`, `street: "Avenida Paulista"`, `number: "1578"` e `zipCode: "01310200"`

### Requirement: Chave do provedor protegida
A chave do provedor de geocodificação SHALL ser usada só pelo servidor. Ela MUST NOT aparecer em respostas da API nem em corpos de erro, e o frontend MUST NOT precisar dela. Os logs MUST NOT contê-la, inclusive na URL da requisição ao provedor. Os logs de falha MUST registrar só o status e a mensagem devolvidos pelo provedor.

#### Scenario: Chave recusada pelo provedor
- **WHEN** a chave configurada no servidor é recusada pelo provedor e um administrador chama `GET /geocoding?address=Avenida Paulista, 1578`
- **THEN** o sistema responde `503` só com `GEOCODING_UNAVAILABLE`, e nem o corpo da resposta nem o log registrado contêm o valor da chave

### Requirement: Sugerir endereço a partir de um ponto
O sistema SHALL expor `GET /geocoding/reverse?latitude=<número>&longitude=<número>`, que sugere o endereço mais próximo de um ponto do mapa. Os dois parâmetros MUST ser convertidos para número. Um parâmetro ausente, vazio ou não numérico, ou um ponto fora dos limites (`latitude` de −90 a 90, `longitude` de −180 a 180), MUST responder `400` com `[GEOCODING_LOCATION_INVALID]`, sem consultar o provedor.

Em sucesso, MUST responder `200` com:
- `latitude` e `longitude`: o ponto **consultado**, arredondado para 6 casas decimais, e não as coordenadas do resultado do provedor;
- `formattedAddress`: o endereço completo devolvido pelo provedor;
- `zipCode`, `street`, `number`, `neighborhood`, `city` e `state`, cada um texto ou `null`. Um componente MUST ser `null` quando o provedor não o trouxer ou ele não estiver no formato: `zipCode` só com 8 dígitos, sem traço (um CEP incompleto vira `null`), e `state` só como sigla de 2 letras maiúsculas;
- `source`: `"google"` ou `"mock"`.

Quando o provedor não encontrar endereço para o ponto, MUST responder `404` com `[GEOCODING_ADDRESS_NOT_FOUND]`. Quando o provedor estiver indisponível (chave recusada, cota excedida, erro de rede ou ausência de resposta em 5 segundos), MUST responder `503` com `[GEOCODING_UNAVAILABLE]`. A chave do servidor MUST seguir "Chave do provedor protegida". O endpoint MUST NOT criar nem alterar lojas ou clientes.

#### Scenario: Parâmetro ausente ou não numérico
- **WHEN** um usuário autenticado chama `GET /geocoding/reverse?latitude=-23.56` (sem `longitude`) ou `GET /geocoding/reverse?latitude=abc&longitude=-46.65`
- **THEN** o sistema responde `400` com `GEOCODING_LOCATION_INVALID` e o provedor não é consultado

#### Scenario: Ponto fora dos limites
- **WHEN** um usuário autenticado chama `GET /geocoding/reverse?latitude=95&longitude=-46.65`
- **THEN** o sistema responde `400` com `GEOCODING_LOCATION_INVALID`

#### Scenario: Endereço sugerido pelo provedor
- **WHEN** a chave do servidor está configurada e um usuário autenticado chama `GET /geocoding/reverse?latitude=-23.5614141&longitude=-46.6558809`
- **THEN** o sistema responde `200` com `latitude: -23.561414`, `longitude: -46.655881`, `source: "google"`, o `formattedAddress` do provedor e `city: "São Paulo"` e `state: "SP"`

#### Scenario: Componente ausente vira nulo
- **WHEN** a chave do servidor está configurada e o primeiro resultado do provedor para o ponto não traz número e traz um CEP de 5 dígitos
- **THEN** o sistema responde `200` com `number: null` e `zipCode: null`, e os demais componentes preenchidos

#### Scenario: Ponto sem endereço
- **WHEN** a chave do servidor está configurada e o provedor não encontra endereço para o ponto consultado
- **THEN** o sistema responde `404` com `GEOCODING_ADDRESS_NOT_FOUND`

#### Scenario: Provedor indisponível na sugestão
- **WHEN** a chave do servidor está configurada e o provedor recusa a chave ou não responde em 5 segundos
- **THEN** o sistema responde `503` só com `GEOCODING_UNAVAILABLE`, e nem a resposta nem o log contêm o valor da chave

### Requirement: Geocodificação exige usuário autenticado
`GET /geocoding` e `GET /geocoding/reverse` MUST exigir um JWT válido de qualquer usuário, administrador ou não. Sem token, com token expirado ou adulterado o sistema MUST responder `401`, sem consultar o provedor. Com token válido, MUST NOT responder `403`.

#### Scenario: Sem token
- **WHEN** um cliente chama `GET /geocoding?address=Avenida Paulista` ou `GET /geocoding/reverse?latitude=-23.56&longitude=-46.65` sem o cabeçalho `Authorization`
- **THEN** o sistema responde `401` e o provedor não é consultado

#### Scenario: Usuário não administrador
- **WHEN** um usuário do seed com `admin = false` chama `GET /geocoding?address=Avenida Paulista` ou `GET /geocoding/reverse?latitude=-23.56&longitude=-46.65` com o seu token
- **THEN** o sistema responde `200`

#### Scenario: Administrador continua com acesso
- **WHEN** `admin@jaja.dev` chama `GET /geocoding?address=Avenida Paulista` com o seu token
- **THEN** o sistema responde `200`, como antes desta entrega

