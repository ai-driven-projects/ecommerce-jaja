import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../core/errors/app_failure.dart';
import '../../core/result.dart';
import '../../core/value_objects/email.dart';
import '../../core/value_objects/person_name.dart';
import '../../core/value_objects/strong_password.dart';
import '../../modules/auth/errors/auth_errors.dart';
import '../../modules/auth/model/auth_user_entity.dart';
import '../../modules/auth/provider/auth_repository.dart';
import '../api/auth_dto.dart';
import '../http/run_request.dart';
import 'session.dart';
import 'session_status.dart';
import 'session_storage.dart';

/// Sessão do cliente sobre `POST /auth/login`, `POST /auth/register`,
/// `GET /auth/me` e o [SessionStorage] do aparelho, no papel do
/// `auth.context.tsx` do web. Uma só instância atende o domínio
/// ([AuthRepository]) e o router e o interceptor ([Session]).
///
/// Nasce [SessionStatus.unknown]; [restore] decide o estado na abertura. Cada
/// troca de estado avisa os ouvintes e emite o usuário em [userChanges].
final class SessionRepository extends ChangeNotifier
    implements Session, AuthRepository {
  SessionRepository(this._dio, this._storage);

  final Dio _dio;
  final SessionStorage _storage;
  final StreamController<AuthUser?> _userChanges = StreamController.broadcast();

  SessionStatus _status = SessionStatus.unknown;
  String? _token;
  AuthUser? _user;

  @override
  SessionStatus get status => _status;

  @override
  String? get token => _token;

  @override
  AuthUser? get currentUser => _user;

  @override
  Stream<AuthUser?> get userChanges => _userChanges.stream;

  /// Lê a sessão guardada e confere o token com `GET /auth/me`. Chamada uma
  /// vez pelo bootstrap; fora de [SessionStatus.unknown] não faz nada.
  Future<void> restore() async {
    if (_status != SessionStatus.unknown) return;

    final text = await _storage.read();
    if (text == null || text.isEmpty) return _end();

    final StoredSession stored;
    try {
      stored = decodeStoredSession(text);
    } on FormatException {
      await _storage.clear();
      return _end();
    }

    // O token ainda não está em memória: o cabeçalho vai explícito, e o
    // interceptor não trata este `401` como expiração.
    final result = await runRequest(
      () => _dio.get<Object?>(
        '/auth/me',
        options: Options(headers: {'Authorization': 'Bearer ${stored.token}'}),
      ),
      parseAuthUser,
    );
    if (_status != SessionStatus.unknown) return;

    switch (result) {
      case Ok(value: final user):
        await _start(StoredSession(token: stored.token, user: user));
      case Failure(failure: SessionFailure()):
        await _storage.clear();
        _end();
      case Failure():
        // Sem rede ou servidor fora: segue com o usuário guardado, como o web
        // confia no cookie; um `401` posterior encerra pelo [expire].
        _set(SessionStatus.authenticated, stored.token, stored.user);
    }
  }

  @override
  Future<Result<AuthUser>> signIn(Email email, StrongPassword password) async {
    final result = await runRequest(
      () => _dio.post<Object?>(
        '/auth/login',
        data: {'email': email.value, 'password': password.value},
      ),
      parseLoginResponse,
    );
    switch (result) {
      case Ok(value: final session):
        await _start(session);
        return Ok(session.user);
      case Failure(failure: SessionFailure()):
        return _rejected(401, const [
          'INVALID_CREDENTIALS',
        ], .invalidCredentials);
      case Failure(
        failure: BackendRejectionFailure(:final statusCode, :final codes),
      ):
        return _rejected(statusCode, codes, .signInFailed);
      case Failure(:final failure):
        return Failure(failure);
    }
  }

  @override
  Future<Result<AuthUser>> signUp(
    PersonName name,
    Email email,
    StrongPassword password,
  ) async {
    // `201` sem corpo; o `admin` nunca vai (o backend decide).
    final result = await runRequest(
      () => _dio.post<Object?>(
        '/auth/register',
        data: {
          'name': name.value,
          'email': email.value,
          'password': password.value,
        },
      ),
      (_) {},
    );
    switch (result) {
      case Ok():
        return signIn(email, password);
      case Failure(
        failure: BackendRejectionFailure(:final statusCode, :final codes),
      ):
        return _rejected(
          statusCode,
          codes,
          codes.contains('EMAIL_ALREADY_EXISTS')
              ? .emailAlreadyExists
              : .signUpFailed,
        );
      case Failure(:final failure):
        return Failure(failure);
    }
  }

  @override
  Future<void> signOut() async {
    await _storage.clear();
    _end();
  }

  @override
  void expire() {
    if (_status != SessionStatus.authenticated) return;
    unawaited(_storage.clear());
    _end();
  }

  Future<void> _start(StoredSession session) async {
    await _storage.write(session.encode());
    _set(SessionStatus.authenticated, session.token, session.user);
  }

  void _end() => _set(SessionStatus.anonymous, null, null);

  void _set(SessionStatus status, String? token, AuthUser? user) {
    _status = status;
    _token = token;
    _user = user;
    notifyListeners();
    _userChanges.add(user);
  }

  Failure<AuthUser> _rejected(
    int statusCode,
    List<String> codes,
    AuthErrorCode code,
  ) => Failure(
    BackendRejectionFailure(
      message: code.message,
      code: code,
      statusCode: statusCode,
      codes: codes,
    ),
  );

  @override
  void dispose() {
    _userChanges.close();
    super.dispose();
  }
}
