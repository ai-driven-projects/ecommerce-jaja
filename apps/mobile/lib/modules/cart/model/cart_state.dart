import '../../../core/errors/app_failure.dart';
import 'cart_entity.dart';

/// Estado do carrinho exposto pelo `CartRepository`. [items] é a verdade local
/// (muda na hora); [detail] é a última prévia bem-sucedida, ou
/// `CartDetail.empty()` antes dela. [isSyncing] marca uma mudança ainda não
/// confirmada por uma prévia; [previewFailure], a falha da última prévia.
final class CartState {
  CartState({
    List<CartItem> items = const [],
    CartDetail? detail,
    this.isRestoring = false,
    this.isSyncing = false,
    this.previewFailure,
  }) : items = List.unmodifiable(items),
       detail = detail ?? CartDetail.empty();

  final List<CartItem> items;
  final CartDetail detail;
  final bool isRestoring;
  final bool isSyncing;
  final AppFailure? previewFailure;

  /// Soma local das quantidades, inclusive de linhas indisponíveis (o badge).
  int get count => items.fold(0, (sum, item) => sum + item.quantity);

  bool get isEmpty => items.isEmpty;

  /// Linhas da prévia com a quantidade local aplicada; as que saíram do
  /// carrinho ficam de fora (o `applyQuantities` de
  /// `apps/frontend/src/modules/orders/data/cart.context.tsx`).
  List<CartLine> get lines {
    final quantities = {
      for (final item in items) item.productId: item.quantity,
    };
    return List.unmodifiable([
      for (final line in detail.lines)
        if (quantities[line.productId.toLowerCase()] case final int quantity)
          quantity == line.quantity ? line : line.copyWith(quantity: quantity),
    ]);
  }

  /// Quantidade local do produto, ou 0 fora do carrinho.
  int quantityOf(String productId) {
    final id = productId.trim().toLowerCase();
    return items.where((item) => item.productId == id).firstOrNull?.quantity ??
        0;
  }

  /// Tem itens e nenhuma linha ainda, sem falha: a primeira prévia não voltou.
  bool get awaitsFirstPreview =>
      items.isNotEmpty && detail.lines.isEmpty && previewFailure == null;

  CartState copyWith({
    List<CartItem>? items,
    CartDetail? detail,
    bool? isRestoring,
    bool? isSyncing,
    AppFailure? previewFailure,
    bool clearPreviewFailure = false,
  }) {
    return CartState(
      items: items ?? this.items,
      detail: detail ?? this.detail,
      isRestoring: isRestoring ?? this.isRestoring,
      isSyncing: isSyncing ?? this.isSyncing,
      previewFailure: clearPreviewFailure
          ? null
          : previewFailure ?? this.previewFailure,
    );
  }
}
