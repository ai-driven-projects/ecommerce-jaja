import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../infra/auth/session.dart';
import '../../infra/auth/session_status.dart';
import '../../infra/di/service_locator.dart';
import '../../modules/catalog/model/product_query_params.dart';
import '../../ui/modules/auth/pages/account_page.dart';
import '../../ui/modules/auth/pages/login_page.dart';
import '../../ui/modules/auth/pages/register_page.dart';
import '../../ui/modules/auth/view_models/account_view_model.dart';
import '../../ui/modules/auth/view_models/login_view_model.dart';
import '../../ui/modules/auth/view_models/register_view_model.dart';
import '../../ui/modules/cart/pages/cart_page.dart';
import '../../ui/modules/catalog/pages/home_page.dart';
import '../../ui/modules/catalog/pages/product_detail_page.dart';
import '../../ui/modules/catalog/pages/search_page.dart';
import '../../ui/modules/catalog/view_models/home_view_model.dart';
import '../../ui/modules/catalog/view_models/product_detail_view_model.dart';
import '../../ui/modules/catalog/view_models/search_view_model.dart';
import '../../ui/modules/store/view_models/store_selector_view_model.dart';
import '../../ui/shared/pages/not_found_page.dart';
import '../../ui/shared/pages/splash_page.dart';
import '../../ui/shared/widgets/app_navigation_shell.dart';
import 'app_routes.dart';
import 'session_redirect.dart';

/// O router do app: um ramo por aba, cada um com a própria pilha. Só os
/// `builder` das rotas buscam ViewModels no `getIt` (regra D da barreira); as
/// páginas recebem a fábrica e a navegação pelo construtor.
///
/// A guarda de sessão ([resolveSessionRedirect]) roda a cada navegação e a
/// cada aviso da [Session] (`refreshListenable`).
GoRouter buildAppRouter({String initialLocation = AppRoutes.home}) {
  final session = getIt<Session>();
  late final GoRouter router;
  void concludeAccess() => _concludePushedAccess(router, session);
  session.addListener(concludeAccess);
  return router = GoRouter(
    initialLocation: initialLocation,
    refreshListenable: session,
    redirect: (context, state) => state.uri.path == '/'
        ? AppRoutes.home
        : resolveSessionRedirect(status: session.status, uri: state.uri),
    errorBuilder: (context, state) =>
        NotFoundPage(onBackHome: () => context.go(AppRoutes.home)),
    routes: [
      // Fora do `StatefulShellRoute`: tela cheia, sem a barra de abas.
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashPage(),
      ),
      // Quem leva ao destino depois de entrar é a guarda; trocar de tela
      // substitui a atual e mantém o mesmo `from`.
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => LoginPage(
          loginViewModelFactory: () => getIt<LoginViewModel>(),
          onClose: () => _closeAccess(context),
          onOpenRegister: () => context.pushReplacement(
            AppRoutes.registerLocation(from: _from(state)),
          ),
        ),
      ),
      GoRoute(
        path: AppRoutes.register,
        builder: (context, state) => RegisterPage(
          registerViewModelFactory: () => getIt<RegisterViewModel>(),
          onClose: () => _closeAccess(context),
          onOpenLogin: () => context.pushReplacement(
            AppRoutes.loginLocation(from: _from(state)),
          ),
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppNavigationShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => HomePage(
                  storeSelectorViewModelFactory: () =>
                      getIt<StoreSelectorViewModel>(),
                  homeViewModelFactory: () => getIt<HomeViewModel>(),
                  onOpenSearch: (query) =>
                      context.go(AppRoutes.searchLocation(query)),
                  onOpenProduct: (slug) =>
                      context.push(AppRoutes.productLocation(slug)),
                ),
                routes: [
                  // Filha de /home: fica na pilha da aba Início, com a barra
                  // de abas visível.
                  GoRoute(
                    path: AppRoutes.productSegment,
                    builder: (context, state) => _productDetailPage(
                      context,
                      state,
                      productLocation: AppRoutes.productLocation,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.search,
                builder: (context, state) => SearchPage(
                  searchViewModelFactory: () => getIt<SearchViewModel>(),
                  initialQuery: decodeProductQuery(state.uri.queryParameters),
                  // O filtro em vigor volta para a rota; o `go` reconstrói a
                  // mesma página (a chave é o caminho, sem a query).
                  onQueryChanged: (query) =>
                      context.go(AppRoutes.searchLocation(query)),
                  onOpenProduct: (slug) =>
                      context.push(AppRoutes.searchProductLocation(slug)),
                ),
                routes: [
                  // Filha de /search: fica na pilha da aba Buscar, e voltar
                  // mostra a listagem com os itens e a rolagem.
                  GoRoute(
                    path: AppRoutes.searchProductSegment,
                    builder: (context, state) => _productDetailPage(
                      context,
                      state,
                      productLocation: AppRoutes.searchProductLocation,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.cart,
                builder: (context, state) => const CartPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.account,
                builder: (context, state) => AccountPage(
                  accountViewModelFactory: () => getIt<AccountViewModel>(),
                  onOpenLogin: () => context.push(
                    AppRoutes.loginLocation(from: AppRoutes.account),
                  ),
                  onOpenRegister: () => context.push(
                    AppRoutes.registerLocation(from: AppRoutes.account),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

/// Conclui o "Entrar" ou "Criar conta" aberto com `push` (a aba Conta): o
/// `redirect` do go_router só vê a rota de base (`/account`), não a empilhada,
/// e não tira a tela de acesso da pilha. Com a sessão, leva ao destino de
/// `from` com a mesma regra da guarda. Para de ouvir quando o router sai da
/// árvore.
void _concludePushedAccess(GoRouter router, Session session) {
  if (router.routerDelegate.navigatorKey.currentContext == null) return;
  if (session.status != SessionStatus.authenticated) return;
  final top = router.routerDelegate.currentConfiguration.lastOrNull;
  if (top is! ImperativeRouteMatch) return;
  final uri = top.matches.uri;
  if (uri.path != AppRoutes.login && uri.path != AppRoutes.register) return;
  router.go(
    resolveSessionRedirect(status: session.status, uri: uri) ?? AppRoutes.home,
  );
}

/// O destino pedido a "Entrar" ou "Criar conta", como chegou na query.
String? _from(GoRouterState state) =>
    state.uri.queryParameters[AppRoutes.fromParam];

/// Fecha "Entrar" ou "Criar conta": volta à tela anterior ou, aberta direto,
/// à Início.
void _closeAccess(BuildContext context) =>
    context.canPop() ? context.pop() : context.go(AppRoutes.home);

/// Página do produto de uma das pilhas: [productLocation] empilha outro
/// produto na mesma aba; a marca, a trilha e "Voltar ao catálogo" levam à
/// aba Buscar. O carrinho chega na etapa 9: até lá, o botão fica desabilitado.
ProductDetailPage _productDetailPage(
  BuildContext context,
  GoRouterState state, {
  required String Function(String slug) productLocation,
}) {
  return ProductDetailPage(
    slug: state.pathParameters['slug']!,
    productDetailViewModelFactory: () => getIt<ProductDetailViewModel>(),
    onBack: () => context.pop(),
    onOpenSearch: (query) => context.go(AppRoutes.searchLocation(query)),
    onOpenProduct: (slug) => context.push(productLocation(slug)),
  );
}
