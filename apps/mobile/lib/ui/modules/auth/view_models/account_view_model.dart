import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../../core/command.dart';
import '../../../../core/result.dart';
import '../../../../modules/auth/model/auth_user_entity.dart';
import '../../../../modules/auth/provider/auth_repository.dart';

/// Estado da aba Conta: o usuário da sessão (convite quando `null`),
/// acompanhando cada entrada, saída ou expiração, e a ação "Sair".
class AccountViewModel extends ChangeNotifier {
  AccountViewModel(this._repository) : _user = _repository.currentUser {
    signOut = Command0<void>(_signOut, onStateChange: notifyListeners);
    _subscription = _repository.userChanges.listen(_onUserChanged);
  }

  final AuthRepository _repository;

  late final Command0<void> signOut;

  late final StreamSubscription<AuthUser?> _subscription;
  AuthUser? _user;

  AuthUser? get user => _user;

  @override
  void dispose() {
    unawaited(_subscription.cancel());
    super.dispose();
  }

  void _onUserChanged(AuthUser? user) {
    _user = user;
    notifyListeners();
  }

  Future<Result<void>> _signOut() async {
    await _repository.signOut();
    return const Ok(null);
  }
}
