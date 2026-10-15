import '../../../core/result.dart';
import '../../../core/value_objects/city_state.dart';
import '../../store/model/current_store.dart';
import '../../store/provider/store_repository.dart';
import '../model/customer_entity.dart';
import '../provider/customer_repository.dart';

/// O que a tela "Dados de entrega" precisa para abrir: o cadastro, ou `null`
/// sem cadastro, e a cidade/UF da loja em vigor para pré-preencher o
/// formulário vazio ([defaultPlace], só sem cadastro e quando a loja as traz).
final class DeliveryDetails {
  const DeliveryDetails({required this.customer, required this.defaultPlace});

  final Customer? customer;
  final CityState? defaultPlace;

  @override
  bool operator ==(Object other) =>
      other is DeliveryDetails &&
      other.customer == customer &&
      other.defaultPlace == defaultPlace;

  @override
  int get hashCode => Object.hash(customer, defaultPlace);

  @override
  String toString() => 'DeliveryDetails($customer, $defaultPlace)';
}

/// Junta o cadastro e a loja em vigor. Com cadastro, não consulta as lojas.
/// A falha do cadastro é devolvida; a falha das lojas só deixa
/// [DeliveryDetails.defaultPlace] nulo.
final class LoadDeliveryDetails {
  const LoadDeliveryDetails(this._customers, this._stores);

  final CustomerRepository _customers;
  final StoreRepository _stores;

  Future<Result<DeliveryDetails>> call() async {
    switch (await _customers.fetchMine()) {
      case Failure(:final failure):
        return Failure(failure);
      case Ok(value: final customer?):
        return Ok(DeliveryDetails(customer: customer, defaultPlace: null));
      case Ok():
        return Ok(
          DeliveryDetails(customer: null, defaultPlace: await _storePlace()),
        );
    }
  }

  Future<CityState?> _storePlace() async {
    switch (await _stores.fetchStores()) {
      case Failure():
        return null;
      case Ok(value: final stores):
        final slug = await _stores.readChosenSlug();
        return pickCurrentStore(stores, slug)?.place;
    }
  }
}
