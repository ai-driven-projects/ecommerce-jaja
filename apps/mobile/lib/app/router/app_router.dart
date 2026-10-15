import 'package:go_router/go_router.dart';

import '../../infra/di/service_locator.dart';
import '../../ui/modules/auth/pages/account_page.dart';
import '../../ui/modules/cart/pages/cart_page.dart';
import '../../ui/modules/catalog/pages/home_page.dart';
import '../../ui/modules/catalog/pages/search_page.dart';
import '../../ui/modules/store/view_models/store_selector_view_model.dart';
import '../../ui/shared/pages/not_found_page.dart';
import '../../ui/shared/widgets/app_navigation_shell.dart';
import 'app_routes.dart';

/// O router do app: um ramo por aba, cada um com a própria pilha. Só os
/// `builder` das rotas buscam ViewModels no `getIt` (regra D da barreira); as
/// páginas recebem a fábrica pelo construtor.
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
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.search,
                builder: (context, state) => const SearchPage(),
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
