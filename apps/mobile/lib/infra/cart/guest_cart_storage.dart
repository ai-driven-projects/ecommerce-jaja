import 'dart:convert';

import '../../modules/cart/model/cart_entity.dart';
import '../../modules/cart/model/cart_rules.dart';
import '../storage/key_value_store.dart';

/// Carrinho do visitante guardado no aparelho, na mesma chave e no mesmo
/// formato do web (`STORAGE_KEY` e `commitGuestItems` em
/// `apps/frontend/src/modules/orders/data/guest-cart-storage.util.ts`): a
/// lista `[{"productId", "quantity"}]` na ordem de inclusão, sem preço.
///
/// Como o [KeyValueStore], nada aqui lança: texto ausente, ilegível ou memória
/// indisponível é carrinho vazio, e gravação que falha é ignorada.
final class GuestCartStorage {
  GuestCartStorage(this._store);

  /// Chave do web, para a mesma convenção valer nos dois clientes.
  static const storageKey = 'jaja.guest-cart';

  final KeyValueStore _store;

  // Texto guardado na última leitura ou gravação (`null` = chave ausente);
  // [_knowsStored] diz se ele já é conhecido.
  String? _stored;
  bool _knowsStored = false;

  /// Lê e normaliza o conteúdo guardado com [normalizeCartItems].
  Future<List<CartItem>> read() async {
    final raw = await _store.readString(storageKey);
    _stored = raw;
    _knowsStored = true;
    if (raw == null) return const [];
    try {
      return normalizeCartItems(jsonDecode(raw));
    } on FormatException {
      return const [];
    }
  }

  /// Grava [items] (já validados pelas regras); lista vazia apaga a chave.
  /// O mesmo conteúdo da última leitura ou gravação não é regravado.
  Future<void> write(List<CartItem> items) async {
    final next = items.isEmpty ? null : _encode(items);
    if (_knowsStored && next == _stored) return;
    _stored = next;
    _knowsStored = true;
    if (next == null) {
      await _store.remove(storageKey);
    } else {
      await _store.writeString(storageKey, next);
    }
  }

  static String _encode(List<CartItem> items) => jsonEncode([
    for (final item in items)
      {'productId': item.productId, 'quantity': item.quantity},
  ]);
}
