import '../../../core/result.dart';
import '../model/store_entity.dart';

abstract interface class StoreRepository {
  /// Lojas ativas na ordem da API. A lista do primeiro sucesso é reaproveitada
  /// enquanto o app está aberto; [refresh] busca de novo. Falha não é guardada.
  Future<Result<List<Store>>> fetchStores({bool refresh = false});

  /// Slug da loja escolhida no aparelho; `null` sem escolha ou com a memória
  /// indisponível. Nunca falha.
  Future<String?> readChosenSlug();

  /// Lembra só o slug, sem lançar: a troca de loja não depende do disco.
  Future<void> rememberChosenSlug(String slug);
}
