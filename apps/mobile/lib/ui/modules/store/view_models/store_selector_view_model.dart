import 'package:flutter/foundation.dart';

import '../../../../core/command.dart';
import '../../../../core/errors/app_failure.dart';
import '../../../../core/result.dart';
import '../../../../modules/store/model/current_store.dart';
import '../../../../modules/store/model/store_entity.dart';
import '../../../../modules/store/provider/store_repository.dart';

/// Estado do seletor de loja da aba Início. O valor exibido vive em campos
/// próprios ([stores], [current], [failure]), não no `result` dos commands,
/// que é limpo a cada execução.
class StoreSelectorViewModel extends ChangeNotifier {
  StoreSelectorViewModel(this._repository) {
    load = Command0<void>(
      () => _fetch(refresh: false),
      onStateChange: notifyListeners,
    );
    reload = Command0<void>(
      () => _fetch(refresh: true),
      onStateChange: notifyListeners,
    );
    select = Command1<void, String>(_select, onStateChange: notifyListeners);
  }

  final StoreRepository _repository;

  /// Primeira carga, reaproveitando a lista que o repositório já tenha.
  late final Command0<void> load;

  /// "Tentar de novo" e "Atualizar": busca de novo, ignorando a lista guardada.
  late final Command0<void> reload;

  /// Troca a loja em vigor pelo slug e lembra a escolha no aparelho.
  late final Command1<void, String> select;

  List<Store> _stores = const [];
  Store? _current;
  AppFailure? _failure;
  bool _hasLoadedOnce = false;

  /// Lojas ativas na ordem da API; vazia enquanto carrega ou depois de falha.
  List<Store> get stores => _stores;

  Store? get current => _current;

  AppFailure? get failure => _failure;

  /// Verdadeiro depois que a primeira carga terminou, com sucesso ou não; sem
  /// isso, uma falha na primeira carga deixaria o skeleton para sempre.
  bool get hasLoadedOnce => _hasLoadedOnce;

  bool get loading => load.running || reload.running || !_hasLoadedOnce;

  Future<Result<void>> _fetch({required bool refresh}) async {
    final result = await _repository.fetchStores(refresh: refresh);
    switch (result) {
      case Ok(:final value):
        final rememberedSlug = await _repository.readChosenSlug();
        _stores = List.unmodifiable(value);
        _current = pickCurrentStore(_stores, rememberedSlug);
        _failure = null;
        _hasLoadedOnce = true;
        return const Ok(null);
      case Failure(:final failure):
        _stores = const [];
        _current = null;
        _failure = failure;
        _hasLoadedOnce = true;
        return Failure(failure);
    }
  }

  Future<Result<void>> _select(String slug) async {
    if (slug == _current?.slug) return const Ok(null);
    final chosen = _stores.where((store) => store.slug == slug).firstOrNull;
    if (chosen == null) return const Ok(null);

    _current = chosen;
    notifyListeners();
    await _repository.rememberChosenSlug(slug);
    return const Ok(null);
  }
}
