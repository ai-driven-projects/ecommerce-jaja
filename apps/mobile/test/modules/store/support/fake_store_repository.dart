import 'dart:async';
import 'dart:collection';

import 'package:mobile/core/result.dart';
import 'package:mobile/modules/store/model/store_entity.dart';
import 'package:mobile/modules/store/provider/store_repository.dart';

/// [StoreRepository] em memória para os testes de ViewModel e de página, sem
/// rede nem disco. Cada `fetchStores` consome a próxima resposta enfileirada
/// por [enqueue] ou [hold]; com a fila vazia, devolve `Ok(stores)`.
/// [fetchCalls] guarda o `refresh` de cada chamada, na ordem; [rememberCalls]
/// guarda cada slug gravado, para provar que uma troca não gravou nada.
class FakeStoreRepository implements StoreRepository {
  FakeStoreRepository({List<Store> stores = const [], this.rememberedSlug})
    : stores = List.of(stores);

  /// Resposta padrão quando não há nada enfileirado.
  List<Store> stores;

  /// Slug lembrado "no aparelho".
  String? rememberedSlug;

  final List<bool> fetchCalls = [];
  final List<String> rememberCalls = [];
  final Queue<Future<Result<List<Store>>>> _responses = Queue();

  void enqueue(Result<List<Store>> result) {
    _responses.add(Future.value(result));
  }

  /// Segura o próximo `fetchStores` até o teste completar o [Completer],
  /// para observar o estado "carregando".
  Completer<Result<List<Store>>> hold() {
    final completer = Completer<Result<List<Store>>>();
    _responses.add(completer.future);
    return completer;
  }

  @override
  Future<Result<List<Store>>> fetchStores({bool refresh = false}) {
    fetchCalls.add(refresh);
    if (_responses.isEmpty) {
      return Future.value(Ok(List.unmodifiable(stores)));
    }
    return _responses.removeFirst();
  }

  @override
  Future<String?> readChosenSlug() async => rememberedSlug;

  @override
  Future<void> rememberChosenSlug(String slug) async {
    rememberCalls.add(slug);
    rememberedSlug = slug;
  }
}
