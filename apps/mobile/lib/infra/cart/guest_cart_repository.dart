import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../core/result.dart';
import '../../modules/cart/model/cart_entity.dart';
import '../../modules/cart/model/cart_rules.dart';
import '../../modules/cart/model/cart_state.dart';
import '../../modules/cart/provider/cart_repository.dart';
import '../api/cart_dto.dart';
import '../http/run_request.dart';
import 'guest_cart_storage.dart';

/// Carrinho do visitante: itens no [GuestCartStorage] do aparelho e linhas e
/// totais de `POST /cart/preview`, no papel da parte "visitante" de
/// `apps/frontend/src/modules/orders/data/cart.context.tsx`.
///
/// Nasce com `isRestoring`; [restore] lê o aparelho. Cada mudança aceita pelas
/// regras de `cart_rules.dart` vale na hora (estado, aviso e gravação) e
/// reagenda a prévia para [previewDelay] depois (o `PREVIEW_DELAY_MS` do web).
/// Cada prévia abre uma geração, e toda mudança invalida a anterior: resposta
/// superada ou chegada depois do [dispose] é descartada. Produto que não volta
/// como linha sai do carrinho guardado.
final class GuestCartRepository extends ChangeNotifier
    implements CartRepository {
  GuestCartRepository(
    this._dio,
    this._storage, {
    this.previewDelay = const Duration(milliseconds: 250),
  });

  final Dio _dio;
  final GuestCartStorage _storage;

  /// Espera desde a última mudança até pedir a prévia.
  final Duration previewDelay;

  final StreamController<CartState> _changes = StreamController.broadcast();

  CartState _state = CartState(isRestoring: true);
  Future<void>? _restoring;
  Timer? _previewTimer;
  int _generation = 0;
  bool _disposed = false;

  @override
  CartState get state => _state;

  @override
  Stream<CartState> get changes => _changes.stream;

  /// Lê o carrinho guardado e agenda a prévia. Chamada pelo bootstrap sem
  /// esperar; as ações também a chamam e esperam por ela, e a leitura
  /// acontece uma vez só.
  Future<void> restore() => _restoring ??= _restore();

  Future<void> _restore() async {
    final items = await _storage.read();
    if (_disposed) return;
    _set(
      _state.copyWith(
        items: items,
        isRestoring: false,
        isSyncing: items.isNotEmpty,
      ),
    );
    if (items.isNotEmpty) _schedulePreview();
  }

  @override
  Future<Result<void>> add(String productId, int quantity) =>
      _change((items) => addCartItem(items, productId, quantity));

  @override
  Future<Result<void>> setQuantity(String productId, int quantity) =>
      _change((items) => setCartItemQuantity(items, productId, quantity));

  @override
  Future<void> remove(String productId) =>
      _change((items) => Ok(removeCartItem(items, productId)));

  @override
  void refresh() {
    unawaited(
      restore().then((_) {
        if (_disposed) return;
        _previewTimer?.cancel();
        if (_state.items.isNotEmpty && !_state.isSyncing) {
          _set(_state.copyWith(isSyncing: true));
        }
        unawaited(_preview());
      }),
    );
  }

  Future<Result<void>> _change(
    Result<List<CartItem>> Function(List<CartItem> items) rule,
  ) async {
    await restore();
    if (_disposed) return const Ok(null);

    switch (rule(_state.items)) {
      case Failure(:final failure):
        return Failure(failure);
      case Ok(value: final items):
        // Invalida a prévia em andamento: ela levou os itens anteriores.
        _generation++;
        _set(_state.copyWith(items: items, isSyncing: items.isNotEmpty));
        _schedulePreview();
        await _storage.write(items);
        return const Ok(null);
    }
  }

  void _schedulePreview() {
    _previewTimer?.cancel();
    _previewTimer = Timer(previewDelay, () => unawaited(_preview()));
  }

  Future<void> _preview() async {
    _previewTimer?.cancel();
    final generation = ++_generation;
    final requested = _state.items;

    // Carrinho vazio não chama a API: os totais zerados são os do web.
    if (requested.isEmpty) {
      _set(
        _state.copyWith(
          detail: CartDetail.empty(),
          isSyncing: false,
          clearPreviewFailure: true,
        ),
      );
      return;
    }

    final result = await runRequest(
      () =>
          _dio.post<Object?>('/cart/preview', data: encodeCartItems(requested)),
      parseCartDetail,
    );
    if (_disposed || generation != _generation) return;

    switch (result) {
      case Ok(value: final detail):
        final returned = {
          for (final line in detail.lines) line.productId.toLowerCase(),
        };
        final kept = requested
            .where((item) => returned.contains(item.productId))
            .toList();
        _set(
          _state.copyWith(
            items: kept,
            detail: detail,
            isSyncing: false,
            clearPreviewFailure: true,
          ),
        );
        if (kept.length != requested.length) await _storage.write(kept);
      case Failure(:final failure):
        _set(_state.copyWith(isSyncing: false, previewFailure: failure));
    }
  }

  void _set(CartState state) {
    if (_disposed) return;
    _state = state;
    notifyListeners();
    _changes.add(state);
  }

  @override
  void dispose() {
    _disposed = true;
    _previewTimer?.cancel();
    _changes.close();
    super.dispose();
  }
}
