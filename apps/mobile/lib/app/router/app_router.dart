import 'package:go_router/go_router.dart';

import '../../infra/di/service_locator.dart';
import '../../modules/catalog/model/product_query_params.dart';
import '../../ui/modules/auth/pages/account_page.dart';
import '../../ui/modules/cart/pages/cart_page.dart';
import '../../ui/modules/catalog/pages/home_page.dart';
import '../../ui/modules/catalog/pages/product_page.dart';
import '../../ui/modules/catalog/pages/search_page.dart';
import '../../ui/modules/catalog/view_models/home_view_model.dart';
import '../../ui/modules/store/view_models/store_selector_view_model.dart';
import '../../ui/shared/pages/not_found_page.dart';
import '../../ui/shared/widgets/app_navigation_shell.dart';
import 'app_routes.dart';

/// O router do app: um ramo por aba, cada um com a própria pilha. Só os
/// `builder` das rotas buscam ViewModels no `getIt` (regra D da barreira); as
/// páginas recebem a fábrica e a navegação pelo construtor.
GoRouter buildAppRouter({String initialLocation = AppRoutes.home}) {
  return GoRouter(
    initialLocation: initialLocation,
    redirect: (context, state) => state.uri.path == '/' ? AppRoutes.home : null,
    errorBuilder: (context, state) =>
        NotFoundPage(onBackHome: () => context.go(AppRoutes.home)),
    routes: [
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
                    builder: (context, state) => ProductPage(
                      slug: state.pathParameters['slug']!,
                      onBack: () => context.pop(),
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
                  initialQuery: decodeProductQuery(state.uri.queryParameters),
                ),
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
                builder: (context, state) => const AccountPage(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
