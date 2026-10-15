import '../../modules/store/model/store_entity.dart';

/// Loja como `GET /storefront/stores` a devolve: `StorefrontStoreDTO` em
/// `modules/stores/src/store/dto/storefront-store.dto.ts`, escrito à mão.
///
/// Os casts são estritos: campo ausente ou de outro tipo lança `TypeError`,
/// que o `runRequest` converte em falha inesperada. Campos a mais na resposta
/// são ignorados.
final class StorefrontStoreDto {
  const StorefrontStoreDto({
    required this.id,
    required this.name,
    required this.slug,
    required this.address,
    required this.latitude,
    required this.longitude,
    required this.deliveryRadiusMeters,
  });

  factory StorefrontStoreDto.fromJson(Map<String, Object?> json) {
    return StorefrontStoreDto(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      address: json['address'] as String?,
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      deliveryRadiusMeters: json['deliveryRadiusMeters'] as int,
    );
  }

  final String id;
  final String name;
  final String slug;
  final String? address;
  final double latitude;
  final double longitude;
  final int deliveryRadiusMeters;

  Store toEntity() {
    return Store(
      id: id,
      name: name,
      slug: slug,
      address: address,
      latitude: latitude,
      longitude: longitude,
      deliveryRadiusMeters: deliveryRadiusMeters,
    );
  }
}

/// Converte o corpo de `GET /storefront/stores` (lista de lojas, na ordem da
/// API) nas entidades. Qualquer outra forma de corpo lança, e o `runRequest`
/// transforma isso em falha inesperada.
List<Store> parseStorefrontStores(Object? data) {
  final items = data as List<Object?>;
  return List.unmodifiable(
    items.map(
      (item) =>
          StorefrontStoreDto.fromJson(item as Map<String, Object?>).toEntity(),
    ),
  );
}
