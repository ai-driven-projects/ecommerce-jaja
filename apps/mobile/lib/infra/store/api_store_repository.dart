import 'package:dio/dio.dart';

import '../../core/result.dart';
import '../../modules/store/model/store_entity.dart';
import '../../modules/store/provider/store_repository.dart';
import '../api/storefront_store_dto.dart';
import '../http/run_request.dart';
import '../storage/key_value_store.dart';

/// A mesma chave do web (`STOREFRONT_STORE_STORAGE_KEY` em
/// `apps/frontend/src/modules/catalog/data/use-storefront.hook.ts`): guarda só
/// o slug da loja escolhida, em texto puro.
const _chosenStoreKey = 'jaja:vitrine:loja';

/// [StoreRepository] sobre `GET /storefront/stores` (público, sem token) e o
/// [KeyValueStore] do aparelho. Registrado como singleton: a lista do primeiro
/// sucesso vale para o app inteiro, como a carga única por aba do web.
final class ApiStoreRepository implements StoreRepository {
  ApiStoreRepository(this._dio, this._storage);

  final Dio _dio;
  final KeyValueStore _storage;

  List<Store>? _loaded;
  Future<Result<List<Store>>>? _pending;

  @override
  Future<Result<List<Store>>> fetchStores({bool refresh = false}) {
    final loaded = _loaded;
    if (!refresh && loaded != null) return Future.value(Ok(loaded));

    // Chamadas simultâneas compartilham a requisição em andamento (o
    // `pendingStores` do web); a próxima chamada depois dela decide sozinha.
    return _pending ??= _load().whenComplete(() => _pending = null);
  }

  Future<Result<List<Store>>> _load() async {
    final result = await runRequest(
      () => _dio.get<Object?>('/storefront/stores'),
      parseStorefrontStores,
    );
    // Falha não é guardada: a próxima tentativa busca de novo.
    if (result case Ok(:final value)) _loaded = value;
    return result;
  }

  @override
  Future<String?> readChosenSlug() async {
    final slug = (await _storage.readString(_chosenStoreKey))?.trim();
    return slug == null || slug.isEmpty ? null : slug;
  }

  @override
  Future<void> rememberChosenSlug(String slug) =>
      _storage.writeString(_chosenStoreKey, slug);
}
