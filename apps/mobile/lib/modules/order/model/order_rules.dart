// Limites copiados de `modules/orders/src/order/errors.ts`
// (`ORDER_RECIPIENT_NAME_MAX_LENGTH`, `ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH`).
// Valem depois de aparar e só limitam os campos; quem valida é o servidor
// (o mínimo de 2 em "Quem recebe" volta como `TEXT_TOO_SHORT`).

/// Tamanho máximo de "Quem recebe".
const orderRecipientNameMaxLength = 100;

/// Tamanho máximo de "Instruções para o entregador".
const orderDeliveryInstructionsMaxLength = 200;
