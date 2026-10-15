import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/errors/app_failure.dart';
import '../../core/result.dart';
import '../../modules/cart/model/account_cart_items.dart';
import '../../modules/cart/model/cart_entity.dart';
import '../../modules/cart/model/cart_rules.dart';
import '../../modules/cart/model/cart_state.dart';
import '../../modules/cart/provider/cart_repository.dart';
import '../auth/session.dart';
import '../auth/session_status.dart';
import 'account_cart_api.dart';
import 'guest_cart_repository.dart';

/// O [CartRepository] do app: escolhe a fonte pela sessão, no papel de
/// `apps/frontend/src/modules/orders/data/cart.context.tsx`.
///
/// A chave da fonte é o token (`authenticated` → [Session.token], senão
/// `null`); aviso da sessão sem troca de token é ignorado. Sem token, tudo é
/// delegado ao [GuestCartRepository], e os avisos dele são repassados. Com
/// token novo, abre uma geração e carrega o carrinho da conta: mescla os itens
/// do visitante (apagados do aparelho só no sucesso) ou faz `GET /me/cart`.
///
/// Na conta, os comandos passam pelas regras de `cart_rules.dart`, mudam a
/// quantidade na hora (overrides) e entram numa fila: cada envio só sai
/// depois da resposta do anterior. A troca de token abre outra geração e
/// começa outra fila; resposta ou tarefa de geração antiga é descartada e não
/// envia nada. Nenhuma chamada apaga o carrinho da conta ao sair.
final class SessionCartRepository extends ChangeNotifier
    implements CartRepository {
  SessionCartRepository(this._guest, this._api, this._session);

  final GuestCartRepository _guest;
  final AccountCartApi _api;
  final Session _session;

  final StreamController<CartState> _changes = StreamController.broadcast();
  StreamSubscription<CartState>? _guestSubscription;
  bool _started = false;
  bool _disposed = false;

  /// Token da fonte atual; `null` é o visitante.
  String? _token;
  int _generation = 0;
  Future<void> _queue = Future.value();

  // Estado da conta, descartado a cada troca de token.
  CartDetail? _detail;
  final Map<String, int> _overrides = {};
  int _pending = 0;
  AppFailure? _loadFailure;
  AppFailure? _mergeFailure;

  bool get _onAccount => _token != null;

  @override
  CartState get state => _onAccount ? _accountState() : _guest.state;

  @override
  Stream<CartState> get changes => _changes.stream;

  /// Assina a sessão e o visitante e avalia a sessão atual. Chamada uma vez
  /// pelo bootstrap; as chamadas seguintes não fazem nada.
  void start() {
    if (_started || _disposed) return;
    _started = true;
    _session.addListener(_onSession);
    _guestSubscription = _guest.changes.listen(_onGuestChanged);
    _onSession();
  }

  @override
  Future<Result<void>> add(String productId, int quantity) {
    if (!_onAccount) return _guest.add(productId, quantity);
    final id = _normalizeId(productId);
    return _command(
      (items) => addCartItem(items, id, quantity),
      () => _api.add(id, quantity),
    );
  }

  @override
  Future<Result<void>> setQuantity(String productId, int quantity) {
    if (!_onAccount) return _guest.setQuantity(productId, quantity);
    final id = _normalizeId(productId);
    return _command(
      (items) => setCartItemQuantity(items, id, quantity),
      () => quantity == 0 ? _api.remove(id) : _api.setQuantity(id, quantity),
    );
  }

  @override
  Future<Result<void>> remove(String productId) {
    if (!_onAccount) return _guest.remove(productId);
    final id = _normalizeId(productId);
    return _command(
      (items) => Ok(removeCartItem(items, id)),
      () => _api.remove(id),
    );
  }

  @override
  Future<Result<void>> clear() {
    if (!_onAccount) return _guest.clear();
    return _command((_) => const Ok([]), _api.clear);
  }

  /// O "Tentar de novo": na conta, refaz a mescla se ainda há itens do
  /// visitante, senão lê o carrinho de novo; a falha anterior só é trocada
  /// quando a resposta chega. No visitante, pede a prévia.
  @override
  void refresh() {
    if (!_onAccount) return _guest.refresh();
    final generation = _generation;
    _enqueue(() => _sync(generation));
  }

  void _onSession() {
    final token = _session.status == SessionStatus.authenticated
        ? _session.token
        : null;
    if (token == _token) return;

    _token = token;
    _generation++;
    _queue = Future.value();
    _detail = null;
    _overrides.clear();
    _pending = 0;
    _loadFailure = null;
    _mergeFailure = null;

    if (token == null) {
      _emit(_guest.state);
      return;
    }
    _emit(_accountState());
    final generation = _generation;
    _enqueue(() => _sync(generation));
  }

  void _onGuestChanged(CartState state) {
    if (!_onAccount) _emit(state);
  }

  /// Carga da conta: mescla os itens do visitante, se houver, ou `GET`.
  Future<void> _sync(int generation) async {
    if (!_isCurrent(generation)) return;
    final items = await _guest.pendingItems();
    if (!_isCurrent(generation)) return;
    if (items.isEmpty) return _load(generation);

    switch (await _api.merge(items)) {
      case Ok(value: final detail):
        // A mescla já valeu no servidor: o aparelho é apagado mesmo que a
        // sessão tenha mudado, para não mesclar de novo na próxima entrada.
        await _guest.clear();
        if (!_isCurrent(generation)) return;
        _detail = detail;
        _loadFailure = null;
        _mergeFailure = null;
        _emit(_accountState());
      case Failure(:final failure):
        if (!_isCurrent(generation)) return;
        _mergeFailure = failure;
        _emit(_accountState());
        await _load(generation);
    }
  }

  /// `GET /me/cart`. Na falha, mantém o último carrinho recebido (vazio
  /// antes do primeiro) e guarda a falha em `previewFailure`.
  Future<void> _load(int generation) async {
    if (!_isCurrent(generation)) return;
    final result = await _api.load();
    if (!_isCurrent(generation)) return;
    switch (result) {
      case Ok(value: final detail):
        _detail = detail;
        _loadFailure = null;
      case Failure(:final failure):
        _loadFailure = failure;
    }
    _emit(_accountState());
  }

  Future<Result<void>> _command(
    Result<List<CartItem>> Function(List<CartItem> items) rule,
    Future<Result<CartDetail>> Function() send,
  ) {
    final displayed = _accountState().items;
    switch (rule(displayed)) {
      case Failure(:final failure):
        return Future.value(Failure(failure));
      case Ok(value: final next):
        for (final item in displayed) {
          _overrides[item.productId] = 0;
        }
        for (final item in next) {
          _overrides[item.productId] = item.quantity;
        }
    }
    _pending++;
    _emit(_accountState());

    final generation = _generation;
    final completer = Completer<Result<void>>();
    _enqueue(() async {
      if (!_isCurrent(generation)) return completer.complete(const Ok(null));
      final result = await send();
      if (!_isCurrent(generation)) return completer.complete(_void(result));

      switch (result) {
        case Ok(value: final detail):
          _detail = detail;
          _loadFailure = null;
        case Failure(:final failure):
          if (failure is! SessionFailure) _enqueue(() => _load(generation));
      }
      _pending--;
      if (_pending == 0) _overrides.clear();
      _emit(_accountState());
      completer.complete(_void(result));
    });
    return completer.future;
  }

  /// Põe [task] no fim da fila da geração atual.
  void _enqueue(Future<void> Function() task) {
    _queue = _queue.then((_) => task());
  }

  bool _isCurrent(int generation) =>
      !_disposed && generation == _generation && _onAccount;

  CartState _accountState() => CartState(
    items: accountCartItems(_detail, _overrides),
    detail: _detail,
    isRestoring: _detail == null && _loadFailure == null,
    isSyncing: _pending > 0,
    previewFailure: _loadFailure,
    mergeFailure: _mergeFailure,
  );

  void _emit(CartState state) {
    if (_disposed) return;
    notifyListeners();
    _changes.add(state);
  }

  static String _normalizeId(String productId) =>
      productId.trim().toLowerCase();

  static Result<void> _void(Result<CartDetail> result) => switch (result) {
    Ok() => const Ok(null),
    Failure(:final failure) => Failure(failure),
  };

  @override
  void dispose() {
    _disposed = true;
    if (_started) _session.removeListener(_onSession);
    unawaited(_guestSubscription?.cancel());
    unawaited(_changes.close());
    super.dispose();
  }
}
