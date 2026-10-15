import '../../infra/auth/session_status.dart';
import 'app_routes.dart';

/// Guarda de sessão do router, como função pura: devolve o endereço para onde
/// ir, ou `null` para ficar em [uri]. Na ordem:
///
/// 1. Sessão desconhecida: fora do splash, vai ao splash guardando [uri].
/// 2. No splash com a sessão conhecida: segue para o destino guardado.
/// 3. Com sessão, "Entrar" e "Criar conta" levam ao destino de `from` (é o
///    que conclui o acesso: o aviso do repositório refaz o redirect).
/// 4. Sem sessão, rota que exige sessão leva a "Entrar" guardando [uri] (cobre
///    também a sessão que expira no meio do uso).
///
/// [requiresSession] é trocável para os testes, já que a lista do app nasce
/// vazia.
String? resolveSessionRedirect({
  required SessionStatus status,
  required Uri uri,
  bool Function(String path) requiresSession = AppRoutes.requiresSession,
}) {
  final path = uri.path;
  final from = uri.queryParameters[AppRoutes.fromParam];

  if (status == SessionStatus.unknown) {
    return path == AppRoutes.splash
        ? null
        : AppRoutes.splashLocation(from: uri.toString());
  }
  if (path == AppRoutes.splash) {
    return safeReturnLocation(from) ?? AppRoutes.home;
  }
  if (status == SessionStatus.authenticated &&
      (path == AppRoutes.login || path == AppRoutes.register)) {
    return safeReturnLocation(from) ?? AppRoutes.home;
  }
  if (status == SessionStatus.anonymous && requiresSession(path)) {
    return AppRoutes.loginLocation(from: uri.toString());
  }
  return null;
}

/// O destino de `from` quando é seguro: só caminho relativo iniciado por `/`
/// (não por `//`, que seria outro servidor) e fora do splash, de "Entrar" e
/// de "Criar conta" (que voltariam em laço). Senão, `null`.
String? safeReturnLocation(String? from) {
  if (from == null || !from.startsWith('/') || from.startsWith('//')) {
    return null;
  }
  final uri = Uri.tryParse(from);
  if (uri == null || uri.hasScheme || uri.hasAuthority) return null;
  const blocked = {AppRoutes.splash, AppRoutes.login, AppRoutes.register};
  return blocked.contains(uri.path) ? null : from;
}
