import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/router/session_redirect.dart';
import 'package:mobile/infra/auth/session_status.dart';

String? _redirect(
  SessionStatus status,
  String location, {
  bool Function(String path)? requiresSession,
}) => requiresSession == null
    ? resolveSessionRedirect(status: status, uri: Uri.parse(location))
    : resolveSessionRedirect(
        status: status,
        uri: Uri.parse(location),
        requiresSession: requiresSession,
      );

/// Lista de teste, independente da lista do app.
bool _requiresX(String path) => path == '/x' || path.startsWith('/x/');

void main() {
  group('resolveSessionRedirect', () {
    test('sessão desconhecida fora do splash vai ao splash guardando o '
        'endereço codificado', () {
      expect(
        _redirect(SessionStatus.unknown, '/search?category=escolar'),
        '/splash?from=%2Fsearch%3Fcategory%3Descolar',
      );
    });

    test('sessão desconhecida no splash fica', () {
      expect(_redirect(SessionStatus.unknown, '/splash?from=%2Fhome'), isNull);
    });

    test('no splash com a sessão conhecida segue para o destino guardado', () {
      const location = '/splash?from=%2Fsearch%3Fcategory%3Descolar';

      expect(
        _redirect(SessionStatus.anonymous, location),
        '/search?category=escolar',
      );
      expect(
        _redirect(SessionStatus.authenticated, location),
        '/search?category=escolar',
      );
    });

    test('no splash sem destino vai à Início', () {
      expect(_redirect(SessionStatus.anonymous, '/splash'), AppRoutes.home);
    });

    test('com sessão, "Entrar" e "Criar conta" levam ao destino de from', () {
      expect(
        _redirect(
          SessionStatus.authenticated,
          '/login?from=%2Fsearch%3Fcategory%3Descolar',
        ),
        '/search?category=escolar',
      );
      expect(
        _redirect(SessionStatus.authenticated, '/register?from=%2Faccount'),
        AppRoutes.account,
      );
    });

    test('com sessão, "Entrar" sem destino leva à Início', () {
      expect(_redirect(SessionStatus.authenticated, '/login'), AppRoutes.home);
    });

    test('destino externo, //, ou de acesso leva à Início', () {
      for (final from in [
        'https://exemplo.com',
        '//exemplo.com',
        '/login',
        '/register?from=%2Fhome',
        '/splash',
        'home',
      ]) {
        expect(
          _redirect(
            SessionStatus.authenticated,
            AppRoutes.loginLocation(from: from),
          ),
          AppRoutes.home,
          reason: from,
        );
      }
    });

    test('sem sessão, "Entrar" e "Criar conta" ficam', () {
      expect(_redirect(SessionStatus.anonymous, '/login?from=%2Fx'), isNull);
      expect(_redirect(SessionStatus.anonymous, '/register'), isNull);
    });

    test('sem sessão, rota que exige sessão leva a "Entrar" com o destino', () {
      expect(
        _redirect(
          SessionStatus.anonymous,
          '/x?y=1',
          requiresSession: _requiresX,
        ),
        '/login?from=%2Fx%3Fy%3D1',
      );
      expect(
        _redirect(SessionStatus.anonymous, '/x/1', requiresSession: _requiresX),
        '/login?from=%2Fx%2F1',
      );
    });

    test('com sessão, rota que exige sessão fica', () {
      expect(
        _redirect(
          SessionStatus.authenticated,
          '/x?y=1',
          requiresSession: _requiresX,
        ),
        isNull,
      );
    });

    test('sem sessão, rota fora da lista fica', () {
      expect(
        _redirect(SessionStatus.anonymous, '/xy', requiresSession: _requiresX),
        isNull,
      );
      expect(_redirect(SessionStatus.anonymous, '/account'), isNull);
      expect(
        _redirect(SessionStatus.anonymous, '/search?category=escolar'),
        isNull,
      );
    });
  });

  group('AppRoutes', () {
    test('loginLocation e registerLocation codificam o destino', () {
      expect(AppRoutes.loginLocation(), '/login');
      expect(
        AppRoutes.loginLocation(from: '/x?y=1'),
        '/login?from=%2Fx%3Fy%3D1',
      );
      expect(
        AppRoutes.registerLocation(from: AppRoutes.account),
        '/register?from=%2Faccount',
      );
    });

    test('exigem sessão os dados de entrega, o checkout e o pedido', () {
      expect(AppRoutes.sessionRequiredPaths, {
        '/account/delivery',
        '/cart/checkout',
        '/cart/orders',
      });
      expect(AppRoutes.deliveryDetails, '/account/delivery');
      expect(AppRoutes.checkout, '/cart/checkout');
      expect(AppRoutes.checkoutDelivery, '/cart/checkout/delivery');
      expect(AppRoutes.orderLocation('a b'), '/cart/orders/a%20b');
      expect(AppRoutes.requiresSession(AppRoutes.deliveryDetails), isTrue);
      expect(AppRoutes.requiresSession(AppRoutes.checkout), isTrue);
      expect(AppRoutes.requiresSession('/cart/checkout/delivery'), isTrue);
      expect(AppRoutes.requiresSession('/cart/orders/x'), isTrue);
      expect(AppRoutes.requiresSession(AppRoutes.account), isFalse);
      expect(AppRoutes.requiresSession(AppRoutes.cart), isFalse);
      expect(
        AppRoutes.requiresSession(AppRoutes.cartProductLocation('caneta')),
        isFalse,
      );
    });

    test('sem sessão, os dados de entrega levam a "Entrar" com o destino', () {
      expect(
        _redirect(SessionStatus.anonymous, AppRoutes.deliveryDetails),
        '/login?from=%2Faccount%2Fdelivery',
      );
      expect(
        _redirect(SessionStatus.authenticated, AppRoutes.deliveryDetails),
        isNull,
      );
    });

    test(
      'sem sessão, o checkout e o pedido levam a "Entrar" com o destino',
      () {
        expect(
          _redirect(SessionStatus.anonymous, '/cart/checkout/delivery'),
          '/login?from=%2Fcart%2Fcheckout%2Fdelivery',
        );
        expect(
          _redirect(SessionStatus.anonymous, '/cart/orders/x'),
          '/login?from=%2Fcart%2Forders%2Fx',
        );
        expect(
          _redirect(SessionStatus.authenticated, '/cart/orders/x'),
          isNull,
        );
      },
    );
  });
}
