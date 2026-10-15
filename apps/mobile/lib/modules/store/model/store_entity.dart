import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../core/value_objects/city_state.dart';

part 'store_entity.freezed.dart';

/// Loja ativa da vitrine, com os campos de `StorefrontStoreDTO`.
@freezed
abstract class Store with _$Store {
  const factory Store({
    required String id,
    required String name,
    required String slug,
    required String? address,
    required double latitude,
    required double longitude,
    required int deliveryRadiusMeters,
  }) = _Store;

  const Store._();

  /// Cidade/UF lidas do fim do endereço de referência; `null` fora do formato.
  CityState? get place => CityState.fromAddressTail(address);
}
