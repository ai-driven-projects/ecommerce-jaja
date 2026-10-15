import 'package:freezed_annotation/freezed_annotation.dart';

part 'customer_entity.freezed.dart';

/// Cadastro de cliente do usuário da sessão (`CustomerDTO`), com os campos
/// crus como a API devolve: [cpf] e [phone] só com dígitos. Nome e e-mail não
/// entram: são da conta de acesso.
@freezed
abstract class Customer with _$Customer {
  const factory Customer({
    required String id,
    required String cpf,
    required String phone,
    required CustomerAddress address,
  }) = _Customer;
}

/// Endereço de entrega (`CustomerAddressDTO`): [zipCode] com 8 dígitos,
/// [state] em maiúsculas. [location] é o ponto marcado no web; o app só o
/// repassa, sem criar, mudar nem apagar.
@freezed
abstract class CustomerAddress with _$CustomerAddress {
  const factory CustomerAddress({
    required String zipCode,
    required String street,
    required String number,
    required String? complement,
    required String neighborhood,
    required String city,
    required String state,
    required CustomerLocation? location,
  }) = _CustomerAddress;
}

/// Ponto do endereço no mapa (`CustomerLocationDTO`).
@freezed
abstract class CustomerLocation with _$CustomerLocation {
  const factory CustomerLocation({
    required double latitude,
    required double longitude,
  }) = _CustomerLocation;
}
