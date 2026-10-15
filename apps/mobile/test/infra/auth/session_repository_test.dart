import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/email.dart';
import 'package:mobile/core/value_objects/person_name.dart';
import 'package:mobile/core/value_objects/strong_password.dart';
import 'package:mobile/infra/api/auth_dto.dart';
import 'package:mobile/infra/auth/session_repository.dart';
import 'package:mobile/infra/auth/session_status.dart';
import 'package:mobile/infra/http/api_client.dart';
import 'package:mobile/modules/auth/errors/auth_errors.dart';
import 'package:mobile/modules/auth/model/auth_user_entity.dart';

import '../../modules/auth/support/auth_fixtures.dart';
import '../api/support/auth_json.dart';
import '../http/support/fake_http_client_adapter.dart';
import 'support/fake_session_storage.dart';

T _valueOf<T>(Result<T> result) => (result as Ok<T>).value;

final _email = _valueOf(Email.create('Ana@Exemplo.com'));
final _password = _valueOf(StrongPassword.create('#Senha123'));
final _name = _valueOf(PersonName.create(' Ana Souza '));

/// Sessão guardada com outro nome, para distinguir o usuário guardado do
/// devolvido pelo `/auth/me`.
final _storedOldName = StoredSession(
  token: anaToken,
  user: ana.copyWith(name: 'Ana S. Antiga'),
).encode();

const _invalidCredentialsBody = {
  'statusCode': 401,
  'message': 'INVALID_CREDENTIALS',
  'error': 'Unauthorized',
};

void main() {
  late FakeHttpClientAdapter adapter;
  late FakeSessionStorage storage;
  late SessionRepository repository;
  late int notifications;
  late List<AuthUser?> emitted;

  setUp(() {
    adapter = FakeHttpClientAdapter();
    storage = FakeSessionStorage();
    final dio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = adapter;
    repository = SessionRepository(dio, storage);
    notifications = 0;
    repository.addListener(() => notifications++);
    emitted = [];
    repository.userChanges.listen(emitted.add);
  });

  tearDown(() => repository.dispose());

  String? authorizationOf(RequestOptions request) => request.headers.entries
      .where((entry) => entry.key.toLowerCase() == 'authorization')
      .map((entry) => entry.value as String?)
      .firstOrNull;

  AppFailure failureOf(Result<AuthUser> result) =>
      (result as Failure<AuthUser>).failure;

  void expectAnonymous() {
    expect(repository.status, SessionStatus.anonymous);
    expect(repository.token, isNull);
    expect(repository.currentUser, isNull);
  }

  group('restore', () {
    test('nasce unknown, sem token nem usuário', () {
      expect(repository.status, SessionStatus.unknown);
      expect(repository.token, isNull);
      expect(repository.currentUser, isNull);
    });

    test('sem sessão guardada fica anonymous sem requisição', () async {
      await repository.restore();
      await pumpEventQueue();

      expectAnonymous();
      expect(adapter.requests, isEmpty);
      expect(storage.clears, 0);
      expect(notifications, 1);
      expect(emitted, [null]);
    });

    test('/auth/me 200 autentica com o usuário novo, grava e manda o Bearer '
        'guardado', () async {
      storage.value = _storedOldName;
      adapter.enqueueResponse(body: anaMeJson);

      await repository.restore();
      await pumpEventQueue();

      final request = adapter.requests.single;
      expect(request.method, 'GET');
      expect(request.uri.toString(), 'http://localhost:4000/auth/me');
      expect(authorizationOf(request), 'Bearer $anaToken');
      expect(repository.status, SessionStatus.authenticated);
      expect(repository.token, anaToken);
      expect(repository.currentUser, ana);
      expect(
        decodeStoredSession(storage.writes.single),
        const StoredSession(token: anaToken, user: ana),
      );
      expect(notifications, 1);
      expect(emitted, [ana]);
    });

    test('/auth/me 401 apaga a sessão guardada e fica anonymous', () async {
      storage.value = _storedOldName;
      adapter.enqueueResponse(
        statusCode: 401,
        body: const {'statusCode': 401, 'message': 'Unauthorized'},
      );

      await repository.restore();

      expectAnonymous();
      expect(storage.clears, 1);
      expect(storage.value, isNull);
      expect(notifications, 1);
    });

    test('sem rede segue autenticado com o usuário guardado', () async {
      storage.value = _storedOldName;
      adapter.enqueueError(DioExceptionType.connectionError);

      await repository.restore();

      expect(repository.status, SessionStatus.authenticated);
      expect(repository.token, anaToken);
      expect(repository.currentUser?.name, 'Ana S. Antiga');
      expect(storage.clears, 0);
      expect(storage.writes, isEmpty);
    });

    test('servidor fora segue autenticado com o usuário guardado', () async {
      storage.value = _storedOldName;
      adapter.enqueueResponse(statusCode: 503);

      await repository.restore();

      expect(repository.status, SessionStatus.authenticated);
      expect(repository.currentUser?.name, 'Ana S. Antiga');
    });

    test(
      'conteúdo ilegível é apagado e fica anonymous sem requisição',
      () async {
        storage.value = '{"token": "abc"';

        await repository.restore();

        expectAnonymous();
        expect(storage.clears, 1);
        expect(adapter.requests, isEmpty);
      },
    );

    test('conteúdo fora do formato também é apagado', () async {
      storage.value = jsonEncode({'token': anaToken});

      await repository.restore();

      expectAnonymous();
      expect(storage.clears, 1);
    });

    test('fora de unknown não faz nada', () async {
      await repository.restore();
      storage.value = _storedOldName;

      await repository.restore();

      expectAnonymous();
      expect(adapter.requests, isEmpty);
      expect(notifications, 1);
    });
  });

  group('signIn', () {
    test(
      'envia POST /auth/login com {email, password} sem Authorization',
      () async {
        adapter.enqueueResponse(body: loginResponseJson);

        await repository.signIn(_email, _password);

        final request = adapter.requests.single;
        expect(request.method, 'POST');
        expect(request.uri.toString(), 'http://localhost:4000/auth/login');
        expect(request.data, {
          'email': 'ana@exemplo.com',
          'password': '#Senha123',
        });
        expect(authorizationOf(request), isNull);
      },
    );

    test('Ok grava, autentica, avisa os ouvintes e emite o usuário', () async {
      adapter.enqueueResponse(body: loginResponseJson);

      final result = await repository.signIn(_email, _password);
      await pumpEventQueue();

      expect(_valueOf(result), ana);
      expect(repository.status, SessionStatus.authenticated);
      expect(repository.token, anaToken);
      expect(repository.currentUser, ana);
      expect(
        decodeStoredSession(storage.value!),
        const StoredSession(token: anaToken, user: ana),
      );
      expect(notifications, 1);
      expect(emitted, [ana]);
    });

    test(
      '401 vira invalidCredentials com a mensagem genérica, sem gravar',
      () async {
        adapter.enqueueResponse(statusCode: 401, body: _invalidCredentialsBody);

        final result = await repository.signIn(_email, _password);

        final failure = failureOf(result);
        expect(failure, isA<BackendRejectionFailure>());
        failure as BackendRejectionFailure;
        expect(failure.code, AuthErrorCode.invalidCredentials);
        expect(failure.message, 'E-mail ou senha inválidos.');
        expect(failure.statusCode, 401);
        expect(failure.codes, ['INVALID_CREDENTIALS']);
        expect(storage.writes, isEmpty);
        expect(repository.status, SessionStatus.unknown);
        expect(notifications, 0);
      },
    );

    test('400 vira signInFailed com os códigos do backend', () async {
      adapter.enqueueResponse(
        statusCode: 400,
        body: const {
          'statusCode': 400,
          'message': ['EMAIL_INVALID'],
        },
      );

      final failure = failureOf(await repository.signIn(_email, _password));

      failure as BackendRejectionFailure;
      expect(failure.code, AuthErrorCode.signInFailed);
      expect(failure.message, 'Não foi possível entrar. Tente novamente.');
      expect(failure.statusCode, 400);
      expect(failure.codes, ['EMAIL_INVALID']);
      expect(storage.writes, isEmpty);
    });

    test('falha de rede passa como NetworkFailure', () async {
      adapter.enqueueError(DioExceptionType.connectionTimeout);

      final failure = failureOf(await repository.signIn(_email, _password));

      expect(failure, isA<NetworkFailure>());
      expect(storage.writes, isEmpty);
      expect(notifications, 0);
    });

    test('corpo fora do formato vira UnexpectedFailure, sem sessão', () async {
      adapter.enqueueResponse(body: loginWithEmptyTokenJson);

      final failure = failureOf(await repository.signIn(_email, _password));

      expect(failure, isA<UnexpectedFailure>());
      expect(storage.writes, isEmpty);
      expect(repository.token, isNull);
    });
  });

  group('signUp', () {
    test('envia só {name, email, password} e depois o login', () async {
      adapter
        ..enqueueResponse(statusCode: 201)
        ..enqueueResponse(body: loginResponseJson);

      final result = await repository.signUp(_name, _email, _password);

      expect(adapter.requests, hasLength(2));
      final register = adapter.requests.first;
      expect(register.method, 'POST');
      expect(register.uri.toString(), 'http://localhost:4000/auth/register');
      expect(register.data, {
        'name': 'Ana Souza',
        'email': 'ana@exemplo.com',
        'password': '#Senha123',
      });
      final login = adapter.requests.last;
      expect(login.uri.path, '/auth/login');
      expect(login.data, {'email': 'ana@exemplo.com', 'password': '#Senha123'});
      expect(_valueOf(result), ana);
      expect(repository.status, SessionStatus.authenticated);
      expect(storage.writes, hasLength(1));
    });

    test(
      '409 EMAIL_ALREADY_EXISTS vira emailAlreadyExists sem login',
      () async {
        adapter.enqueueResponse(
          statusCode: 409,
          body: const {'statusCode': 409, 'message': 'EMAIL_ALREADY_EXISTS'},
        );

        final failure = failureOf(
          await repository.signUp(_name, _email, _password),
        );

        failure as BackendRejectionFailure;
        expect(failure.code, AuthErrorCode.emailAlreadyExists);
        expect(failure.message, 'Este e-mail já está cadastrado.');
        expect(failure.statusCode, 409);
        expect(adapter.requests, hasLength(1));
        expect(storage.writes, isEmpty);
        expect(repository.status, SessionStatus.unknown);
      },
    );

    test('400 vira signUpFailed sem login', () async {
      adapter.enqueueResponse(
        statusCode: 400,
        body: const {
          'statusCode': 400,
          'message': ['NAME_INVALID'],
        },
      );

      final failure = failureOf(
        await repository.signUp(_name, _email, _password),
      );

      failure as BackendRejectionFailure;
      expect(failure.code, AuthErrorCode.signUpFailed);
      expect(
        failure.message,
        'Não foi possível criar a conta. Tente novamente.',
      );
      expect(adapter.requests, hasLength(1));
    });

    test('falha de rede no registro passa como veio, sem login', () async {
      adapter.enqueueError(DioExceptionType.connectionError);

      final failure = failureOf(
        await repository.signUp(_name, _email, _password),
      );

      expect(failure, isA<NetworkFailure>());
      expect(adapter.requests, hasLength(1));
    });

    test('registro aceito e login com falha devolve a falha do login, sem '
        'sessão', () async {
      adapter
        ..enqueueResponse(statusCode: 201)
        ..enqueueResponse(statusCode: 500);

      final failure = failureOf(
        await repository.signUp(_name, _email, _password),
      );

      expect(failure, isA<ServerFailure>());
      expect(adapter.requests, hasLength(2));
      expect(storage.writes, isEmpty);
      expect(repository.token, isNull);
      expect(repository.currentUser, isNull);
      expect(notifications, 0);
    });
  });

  group('signOut e expire', () {
    Future<void> signedIn() async {
      adapter.enqueueResponse(body: loginResponseJson);
      await repository.signIn(_email, _password);
      await pumpEventQueue();
      notifications = 0;
      emitted.clear();
    }

    test('signOut limpa o armazenamento, zera a sessão e avisa', () async {
      await signedIn();

      await repository.signOut();
      await pumpEventQueue();

      expectAnonymous();
      expect(storage.clears, 1);
      expect(storage.value, isNull);
      expect(notifications, 1);
      expect(emitted, [null]);
    });

    test('expire limpa o armazenamento, zera a sessão e avisa', () async {
      await signedIn();

      repository.expire();
      await pumpEventQueue();

      expectAnonymous();
      expect(storage.clears, 1);
      expect(storage.value, isNull);
      expect(notifications, 1);
      expect(emitted, [null]);
    });

    test('expire em unknown não faz nada', () async {
      repository.expire();
      await pumpEventQueue();

      expect(repository.status, SessionStatus.unknown);
      expect(storage.clears, 0);
      expect(notifications, 0);
      expect(emitted, isEmpty);
    });

    test('expire em anonymous não faz nada', () async {
      await repository.restore();
      await pumpEventQueue();
      notifications = 0;
      emitted.clear();

      repository.expire();
      await pumpEventQueue();

      expectAnonymous();
      expect(storage.clears, 0);
      expect(notifications, 0);
      expect(emitted, isEmpty);
    });
  });
}
