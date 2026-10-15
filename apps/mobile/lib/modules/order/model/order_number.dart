/// Número exibido ao cliente: os 8 primeiros caracteres do [id] em
/// maiúsculas (o id inteiro, se for mais curto), como o `formatOrderNumber`
/// de `apps/frontend/src/modules/orders/data/order.util.ts`.
String orderNumberOf(String id) =>
    (id.length > 8 ? id.substring(0, 8) : id).toUpperCase();
