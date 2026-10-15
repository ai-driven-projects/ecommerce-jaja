import 'store_entity.dart';

/// Loja em vigor: a lembrada, se ainda estiver entre as ativas; senão a
/// primeira ativa; sem lojas, nenhuma. Slug nulo ou vazio conta como ausente,
/// e uma lembrança desconhecida é só ignorada (quem chama não a apaga).
Store? pickCurrentStore(List<Store> stores, String? rememberedSlug) {
  if (rememberedSlug != null && rememberedSlug.isNotEmpty) {
    final remembered = stores
        .where((store) => store.slug == rememberedSlug)
        .firstOrNull;
    if (remembered != null) return remembered;
  }
  return stores.firstOrNull;
}
