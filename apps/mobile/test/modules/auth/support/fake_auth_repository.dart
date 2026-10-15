import 'dart:async';
import 'dart:collection';

import 'package:flutter/foundation.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/email.dart';
import 'package:mobile/core/value_objects/person_name.dart';
import 'package:mobile/core/value_objects/strong_password.dart';
import 'package:mobile/infra/auth/session.dart';
import 'package:mobile/infra/auth/session_status.dart';
import 'package:mobile/modules/auth/model/auth_user_entity.dart';
import 'package:mobile/modules/auth/provider/auth_repository.dart';

import 'auth_fixtures.dart' as fixtures;

/// Credenciais recebidas por um `signIn`.
typedef SignInCall = ({Email email, StrongPassword password});

/// Dados recebidos por um `signUp`.
typedef SignUpCall = ({PersonName name, Email email, StrongPassword password});

/// [AuthRepository] em memória para os testes de ViewModel, de página e de
/// rota, sem rede nem disco. Começa com [currentUser] (`null`: sem sessão).
///
/// Cada `signIn` consome a próxima resposta de [enqueueSignIn] ou
/// [holdSignIn]; cada `signUp`, a próxima de [enqueueSignUp] ou [holdSignUp].
/// Com a fila vazia, ambos devolvem `Ok(user)` ([fixtures.ana] por padrão).
/// Como o repositório real, o sucesso de `signIn`/`signUp` e o `signOut`
/// trocam [currentUser], avisam os ouvintes e emitem em [userChanges].
/// [signInCalls], [signUpCalls] e [signOutCalls] gravam as chamadas, na ordem.
///
/// Como [Session], o [status] segue o usuário (`authenticated` com usuário,
/// `anonymous` sem); com `unknown: true` começa desconhecido até o primeiro
/// [emit], como o repositório real antes do `restore`.
class FakeAuthRepository extends ChangeNotifier
    implements AuthRepository, Session {
  FakeAuthRepository({this._currentUser, AuthUser? user, this._unknown = false})
    : user = user ?? fixtures.ana;

  /// Token de [token] enquanto há usuário.
  static const sessionToken = 'token-de-teste';

  /// Usuário devolvido por `signIn`/`signUp` quando não há nada enfileirado.
  AuthUser user;

  final List<SignInCall> signInCalls = [];
  final List<SignUpCall> signUpCalls = [];
  int signOutCalls = 0;
  int expireCalls = 0;

  final Queue<Future<Result<AuthUser>>> _signInResponses = Queue();
  final Queue<Future<Result<AuthUser>>> _signUpResponses = Queue();
  final StreamController<AuthUser?> _userChanges = StreamController.broadcast();

  AuthUser? _currentUser;
  bool _unknown;

  @override
  AuthUser? get currentUser => _currentUser;

  @override
  SessionStatus get status => _unknown
      ? SessionStatus.unknown
      : _currentUser == null
      ? SessionStatus.anonymous
      : SessionStatus.authenticated;

  @override
  String? get token =>
      status == SessionStatus.authenticated ? sessionToken : null;

  @override
  Stream<AuthUser?> get userChanges => _userChanges.stream;

  void enqueueSignIn(Result<AuthUser> result) {
    _signInResponses.add(Future.value(result));
  }

  void enqueueSignUp(Result<AuthUser> result) {
    _signUpResponses.add(Future.value(result));
  }

  /// Segura o próximo `signIn` até o teste completar o [Completer], para
  /// observar o estado "Entrando…".
  Completer<Result<AuthUser>> holdSignIn() {
    final completer = Completer<Result<AuthUser>>();
    _signInResponses.add(completer.future);
    return completer;
  }

  /// Segura o próximo `signUp`, para observar o estado "Criando conta…".
  Completer<Result<AuthUser>> holdSignUp() {
    final completer = Completer<Result<AuthUser>>();
    _signUpResponses.add(completer.future);
    return completer;
  }

  /// Troca o usuário como uma entrada ou saída feita por fora (outra tela,
  /// expiração), avisando os ouvintes e emitindo em [userChanges].
  void emit(AuthUser? user) {
    _unknown = false;
    _currentUser = user;
    notifyListeners();
    _userChanges.add(user);
  }

  @override
  Future<Result<AuthUser>> signIn(Email email, StrongPassword password) {
    signInCalls.add((email: email, password: password));
    return _settle(_next(_signInResponses));
  }

  @override
  Future<Result<AuthUser>> signUp(
    PersonName name,
    Email email,
    StrongPassword password,
  ) {
    signUpCalls.add((name: name, email: email, password: password));
    return _settle(_next(_signUpResponses));
  }

  @override
  Future<void> signOut() async {
    signOutCalls++;
    emit(null);
  }

  /// Como o real: só encerra a sessão `authenticated`.
  @override
  void expire() {
    expireCalls++;
    if (status == SessionStatus.authenticated) emit(null);
  }

  Future<Result<AuthUser>> _next(Queue<Future<Result<AuthUser>>> responses) {
    if (responses.isEmpty) return Future.value(Ok(user));
    return responses.removeFirst();
  }

  Future<Result<AuthUser>> _settle(Future<Result<AuthUser>> response) async {
    final result = await response;
    if (result case Ok(:final value)) emit(value);
    return result;
  }

  @override
  void dispose() {
    _userChanges.close();
    super.dispose();
  }
}
