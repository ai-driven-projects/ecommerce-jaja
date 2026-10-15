import '../../modules/catalog/model/product_query.dart';
import '../../modules/catalog/model/product_query_params.dart';

/// Caminhos das rotas do app, em inglês como o código.
abstract final class AppRoutes {
  static const String home = '/home';
  static const String search = '/search';
  static const String cart = '/cart';
  static const String account = '/account';

  /// Abertura enquanto a sessão é desconhecida; fora das abas (sem barra).
  static const String splash = '/splash';

  /// "Entrar" e "Criar conta", em tela cheia, fora das abas.
  static const String login = '/login';
  static const String register = '/register';

  /// Parâmetro de query com o destino depois da abertura ou do acesso (o
  /// `voltar` do web).
  static const String fromParam = 'from';

  static String splashLocation({String? from}) => _withFrom(splash, from);

  static String loginLocation({String? from}) => _withFrom(login, from);

  static String registerLocation({String? from}) => _withFrom(register, from);

  /// Dados de entrega, na pilha da aba Conta (barra de abas visível).
  static const String deliveryDetails = '$account/$deliveryDetailsSegment';

  /// O trecho de [deliveryDetails] relativo a [account], para a rota filha.
  static const String deliveryDetailsSegment = 'delivery';

  /// "Finalizar pedido", na pilha da aba Carrinho; exige sessão.
  static const String checkout = '$cart/$checkoutSegment';

  /// O trecho de [checkout] relativo a [cart], para a rota filha.
  static const String checkoutSegment = 'checkout';

  /// Dados de entrega abertos pelo checkout, na pilha dele; salvar volta ao
  /// checkout. Fica abaixo de [checkout], que já exige sessão.
  static const String checkoutDelivery = '$checkout/$checkoutDeliverySegment';

  /// O trecho de [checkoutDelivery] relativo a [checkout], para a rota filha.
  static const String checkoutDeliverySegment = 'delivery';

  /// Pedidos da conta, na pilha da aba Carrinho; exigem sessão.
  static const String orders = '$cart/orders';

  /// O trecho do pedido relativo a [cart], para a rota filha.
  static const String orderSegment = 'orders/:id';

  static String orderLocation(String id) =>
      '$orders/${Uri.encodeComponent(id)}';

  /// Rotas que exigem sessão; sem sessão, levam a "Entrar".
  static const Set<String> sessionRequiredPaths = {
    deliveryDetails,
    checkout,
    orders,
  };

  /// Se [path] é uma das [sessionRequiredPaths] ou fica abaixo de uma delas.
  static bool requiresSession(String path) => sessionRequiredPaths.any(
    (required) => path == required || path.startsWith('$required/'),
  );

  static String _withFrom(String path, String? from) => Uri(
    path: path,
    queryParameters: from == null ? null : {fromParam: from},
  ).toString();

  /// Produto por slug, na pilha da aba Início (barra de abas visível).
  static const String product = '$home/$productSegment';

  /// O trecho de [product] relativo a [home], para a rota filha no router.
  static const String productSegment = 'product/:slug';

  static String productLocation(String slug) =>
      '$home/product/${Uri.encodeComponent(slug)}';

  /// Produto por slug, na pilha da aba Buscar (volta à listagem com o estado).
  static const String searchProduct = '$search/$searchProductSegment';

  /// O trecho de [searchProduct] relativo a [search], para a rota filha.
  static const String searchProductSegment = 'product/:slug';

  static String searchProductLocation(String slug) =>
      '$search/product/${Uri.encodeComponent(slug)}';

  /// Produto por slug, na pilha da aba Carrinho.
  static const String cartProduct = '$cart/$cartProductSegment';

  /// O trecho de [cartProduct] relativo a [cart], para a rota filha.
  static const String cartProductSegment = 'product/:slug';

  static String cartProductLocation(String slug) =>
      '$cart/product/${Uri.encodeComponent(slug)}';

  /// A Buscar com os filtros na query, na codificação única dos filtros;
  /// sem `?` quando a consulta é vazia.
  static String searchLocation(ProductQuery query) {
    final params = encodeProductQuery(query);
    return Uri(
      path: search,
      queryParameters: params.isEmpty ? null : params,
    ).toString();
  }
}
