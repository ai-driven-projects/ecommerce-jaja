import 'package:flutter/foundation.dart';

import 'session_status.dart';

/// Contrato técnico da sessão JWT, usado só pelo router (guarda e
/// `refreshListenable`) e pelo interceptor do `dio`. As telas usam o
/// `AuthRepository` do domínio. Avisa os ouvintes a cada troca de [status].
abstract interface class Session implements Listenable {
  SessionStatus get status;

  /// Token da sessão ativa; `null` fora de [SessionStatus.authenticated].
  String? get token;

  /// Encerra a sessão porque o servidor recusou o token (`401`). Só age em
  /// [SessionStatus.authenticated].
  void expire();
}
