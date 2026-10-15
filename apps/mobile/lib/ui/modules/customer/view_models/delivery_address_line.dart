import '../../../../modules/customer/model/customer_entity.dart';
import 'customer_masks.dart';

/// Endereço em uma linha, `"Rua, número · complemento · bairro · cidade/UF ·
/// CEP"`, sem o complemento quando ele é `null` ou vazio. Cópia de
/// `formatCustomerAddress`
/// (`apps/frontend/src/modules/customers/data/customer.util.ts`), com o CEP
/// mascarado por [formatZipCodeInput].
String formatDeliveryAddress(CustomerAddress address) {
  final complement = address.complement?.trim() ?? '';
  return [
    '${address.street}, ${address.number}',
    if (complement.isNotEmpty) complement,
    address.neighborhood,
    '${address.city}/${address.state}',
    formatZipCodeInput(address.zipCode),
  ].join(' · ');
}
