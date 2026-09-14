# Geocodificação de Endereços (Address Geocoding) Specification

## Purpose

Define a busca de coordenadas a partir de um endereço, usada pelo cadastro de lojas para posicionar o ponto no mapa: o endpoint `GET /geocoding` restrito a administradores, o uso do provedor de mapas quando a chave do servidor está configurada, a resposta simulada quando não está e a proteção dessa chave.

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
Quando a chave do provedor não estiver configurada no servidor, `GET /geocoding` SHALL responder a qualquer endereço válido com `200` e sempre o mesmo ponto, sem chamar nenhum serviço externo. A resposta traz `latitude: -23.561414`, `longitude: -46.655881`, `formattedAddress: "Avenida Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200"` e `source: "mock"`. O servidor MUST registrar na inicialização um aviso de que a geocodificação está simulada.

#### Scenario: Endereço de Fortaleza sem chave
- **WHEN** a chave do servidor não está configurada e um administrador chama `GET /geocoding?address=Rua Silva Paulet, 1100, Fortaleza`
- **THEN** o sistema responde `200` com `source: "mock"`, `latitude: -23.561414`, `longitude: -46.655881` e o endereço da Avenida Paulista

### Requirement: Chave do provedor protegida
A chave do provedor de geocodificação SHALL ser usada só pelo servidor. Ela MUST NOT aparecer em respostas da API nem em corpos de erro, e o frontend MUST NOT precisar dela. Os logs MUST NOT contê-la, inclusive na URL da requisição ao provedor. Os logs de falha MUST registrar só o status e a mensagem devolvidos pelo provedor.

#### Scenario: Chave recusada pelo provedor
- **WHEN** a chave configurada no servidor é recusada pelo provedor e um administrador chama `GET /geocoding?address=Avenida Paulista, 1578`
- **THEN** o sistema responde `503` só com `GEOCODING_UNAVAILABLE`, e nem o corpo da resposta nem o log registrado contêm o valor da chave

### Requirement: Geocodificação restrita a administradores
`GET /geocoding` MUST exigir um JWT válido de um usuário com `admin = true`. Sem token, com token expirado ou adulterado o sistema MUST responder `401`; com token válido de usuário não administrador MUST responder `403`. Nenhum desses casos MUST consultar o provedor.

#### Scenario: Sem token
- **WHEN** um cliente chama `GET /geocoding?address=Avenida Paulista` sem o cabeçalho `Authorization`
- **THEN** o sistema responde `401`

#### Scenario: Usuário não administrador
- **WHEN** um usuário do seed com `admin = false` chama `GET /geocoding?address=Avenida Paulista` com o seu token
- **THEN** o sistema responde `403`
