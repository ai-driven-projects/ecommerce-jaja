## MODIFIED Requirements

### Requirement: Cabeçalho do pedido
Com o pedido carregado, a página SHALL exibir:
- o título "Pedido #<número>", em que o número são os 8 primeiros caracteres do id em maiúsculas (por exemplo, `3F1C9A52`);
- o badge com o nome do status atual: "Pedido recebido", "Pagamento aprovado", "Separando na loja", "A caminho" ou "Entregue";
- o indicador de atualização ao vivo, conforme "Atualização ao vivo";
- "Feito hoje às HH:MM" quando o pedido é do dia atual, ou "Feito em DD/MM/AAAA às HH:MM" nos outros dias, no fuso do navegador;
- o endereço de entrega copiado no pedido (logradouro, número, complemento quando houver, bairro e cidade/UF) e o nome de quem recebe.

A aba do navegador MUST ter o título "Pedido #<número> — já já".

#### Scenario: Pedido recém-confirmado
- **WHEN** a cliente abre o acompanhamento do pedido que acabou de confirmar
- **THEN** vê "Pedido #<8 primeiros caracteres do id em maiúsculas>", o badge "Pedido recebido", "Feito hoje às <hora da confirmação>", o endereço de entrega e quem recebe, e a aba tem o título "Pedido #<número> — já já"

#### Scenario: Badge acompanha o status
- **WHEN** a cliente está com o acompanhamento aberto e o pedido passa a `OUT_FOR_DELIVERY`
- **THEN** o badge passa a "A caminho" sem recarregar a página

#### Scenario: Endereço copiado no pedido
- **WHEN** depois de confirmar o pedido a cliente altera o endereço do cadastro e abre o acompanhamento
- **THEN** o cabeçalho mostra o endereço da confirmação, e não o novo

### Requirement: Passos do pedido
A página SHALL exibir os passos "Pedido recebido", "Pagamento aprovado", "Separando na loja", "A caminho" e "Entregue", nessa ordem, cada um correspondendo a um status de `orders/order-lifecycle`. Conforme o status atual:
- os passos até o status atual MUST aparecer concluídos, cada um com a hora com segundos (`HH:MM:SS`, no fuso do navegador) da data do passo, para que a demora de cada serviço simulado fique visível;
- enquanto o pedido não estiver `DELIVERED`, o passo seguinte ao status atual MUST aparecer destacado como em andamento, com o texto "Em andamento…";
- os demais passos MUST aparecer pendentes, com o texto "Aguardando".

Com o pedido `DELIVERED`, todos os passos MUST aparecer concluídos, e a página MUST exibir "Pedido entregue às HH:MM. Obrigado por comprar no já já!". A lista de passos MUST anunciar as mudanças a leitores de tela sem mover o foco, e animações MUST respeitar `prefers-reduced-motion`.

#### Scenario: Pedido recebido
- **WHEN** a cliente abre o acompanhamento de um pedido com status `PLACED`
- **THEN** "Pedido recebido" aparece concluído com a hora do pedido, "Pagamento aprovado" aparece em andamento com "Em andamento…", e "Separando na loja", "A caminho" e "Entregue" aparecem pendentes com "Aguardando"

#### Scenario: Pedido separando
- **WHEN** a cliente abre o acompanhamento de um pedido com status `PICKING`
- **THEN** "Pedido recebido", "Pagamento aprovado" e "Separando na loja" aparecem concluídos com as horas dos passos, "A caminho" aparece em andamento e "Entregue" aparece pendente

#### Scenario: Pedido entregue
- **WHEN** a cliente abre o acompanhamento de um pedido `DELIVERED`
- **THEN** os cinco passos aparecem concluídos com as horas em `HH:MM:SS`, e a página mostra "Pedido entregue às <hora da entrega>. Obrigado por comprar no já já!"

## ADDED Requirements

### Requirement: Atualização ao vivo
Com o pedido carregado e ainda não entregue, a página SHALL abrir o stream `GET /me/orders/:id/stream` enviando o token no cabeçalho `Authorization`. O token MUST NOT aparecer na URL. A página MUST reler o pedido por `GET /me/orders/:id` a cada aviso recebido e a cada reconexão do stream, com no máximo uma leitura em andamento e uma pendente, e MUST atualizar o cabeçalho e os passos sem recarregar.

O indicador do cabeçalho MUST mostrar:
- "Ao vivo", com uma marca verde, enquanto o stream está aberto;
- "Reconectando…" enquanto o stream está sendo aberto ou reaberto;
- nada quando não há stream (pedido entregue ou stream encerrado por `401`/`404`).

Se o stream cair, a página MUST tentar reabri-lo com espera crescente de 1 s até 10 s. Com `401`, `403` ou `404`, a página MUST parar de tentar. A página MUST fechar o stream quando o pedido chega a `DELIVERED`, quando sai da página, quando a sessão muda e quando o id muda.

#### Scenario: Passos avançam sem recarregar
- **WHEN** a cliente confirma um pedido e fica no acompanhamento
- **THEN** a página mostra "Ao vivo" e os passos avançam sozinhos até "Entregue", cada um com a hora, sem recarregar

#### Scenario: Token fora da URL
- **WHEN** a página abre o stream do pedido
- **THEN** a requisição vai para `/me/orders/<id>/stream` sem token na URL e com o cabeçalho `Authorization`

#### Scenario: Backend reinicia no meio
- **WHEN** o backend para durante o ciclo e volta alguns segundos depois
- **THEN** a página mostra "Reconectando…" enquanto o backend está fora e, quando ele volta, mostra "Ao vivo" e o passo atualizado

#### Scenario: Recarregar no meio do ciclo
- **WHEN** a cliente recarrega o acompanhamento de um pedido `PAYMENT_APPROVED`
- **THEN** a página mostra o passo atual e continua avançando ao vivo

#### Scenario: Pedido já entregue
- **WHEN** a cliente abre o acompanhamento de um pedido `DELIVERED`
- **THEN** a página não abre o stream e não mostra o indicador
