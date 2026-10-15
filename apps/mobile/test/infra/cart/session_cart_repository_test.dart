import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/infra/auth/session_status.dart';
import 'package:mobile/infra/cart/account_cart_api.dart';
import 'package:mobile/infra/cart/guest_cart_repository.dart';
import 'package:mobile/infra/cart/guest_cart_storage.dart';
import 'package:mobile/infra/cart/session_cart_repository.dart';
import 'package:mobile/infra/http/api_client.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/modules/cart/model/cart_state.dart';

import '../../modules/auth/support/auth_fixtures.dart' as auth;
import '../../modules/auth/support/fake_auth_repository.dart';
import '../api/support/cart_json.dart';
import '../http/support/fake_http_client_adapter.dart';
import '../storage/support/fake_key_value_store.dart';

const _a = '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e20';
const _b = '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e21';
const _c = '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e22';

CartItem _item(String productId, int quantity) =>
    CartItem(productId: productId, quantity: quantity);

/// Carrinho da conta só com a caneta ([_a]) na [quantity] pedida.
Map<String, Object?> _canetaCart(int quantity) => previewWithLine({
  ...canetaLineJson,
  'quantity': quantity,
  'lineTotalCents': 1290 * quantity,
});

/// [FakeHttpClientAdapter] que segura a próxima resposta até o [gate]
/// atribuído ser completado, para observar a fila e respostas atrasadas.
class _HoldingHttpClientAdapter extends FakeHttpClientAdapter {
  Completer<void>? gate;

  /// Segura a próxima resposta e devolve o [Completer] que a libera.
  Completer<void> hold() => gate = Completer<void>();

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final held = gate;
    gate = null;
    final body = await super.fetch(options, requestStream, cancelFuture);
    if (held != null) await held.future;
    return body;
  }
}

/// [FakeAuthRepository] cujo token pode ser trocado sem passar por
/// `anonymous`, como numa troca de conta.
class _SwitchableAuthRepository extends FakeAuthRepository {
  String sessionTokenValue = FakeAuthRepository.sessionToken;

  @override
  String? get token =>
      status == SessionStatus.authenticated ? sessionTokenValue : null;

  /// Troca o token e avisa os ouvintes, com a sessão ainda `authenticated`.
  void switchToken(String token) {
    sessionTokenValue = token;
    notifyListeners();
  }
}

void main() {
  late FakeHttpClientAdapter guestAdapter;
  late _HoldingHttpClientAdapter accountAdapter;
  late FakeKeyValueStore store;
  late GuestCartRepository guest;
  late _SwitchableAuthRepository session;
  late SessionCartRepository repository;
  late int notifications;
  late List<CartState> emitted;

  /// Monta o repositório com o visitante restaurado sobre [guestItems] e a
  /// sessão ([unknown] ou anônima); [start] não é chamado.
  Future<void> build({List<CartItem> guestItems = const []}) async {
    guestAdapter = FakeHttpClientAdapter();
    accountAdapter = _HoldingHttpClientAdapter();
    store = FakeKeyValueStore();
    final guestStorage = GuestCartStorage(store);
    await guestStorage.write(guestItems);

    // Dio próprio do visitante: a prévia não consome as respostas da conta.
    final guestDio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = guestAdapter;
    final accountDio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = accountAdapter;
    guest = GuestCartRepository(
      guestDio,
      guestStorage,
      previewDelay: Duration.zero,
    );
    session = _SwitchableAuthRepository();
    repository = SessionCartRepository(
      guest,
      AccountCartApi(accountDio),
      session,
    );
    notifications = 0;
    repository.addListener(() => notifications++);
    emitted = [];
    repository.changes.listen(emitted.add);
    addTearDown(() {
      repository.dispose();
      guest.dispose();
      session.dispose();
    });
  }

  /// Requisições da conta como `MÉTODO caminho`.
  List<String> accountCalls() => [
    for (final request in accountAdapter.requests)
      '${request.method} ${request.path}',
  ];

  group('fonte', () {
    test('unknown delega ao visitante', () async {
      await build();
      final unknown = FakeAuthRepository(unknown: true);
      addTearDown(unknown.dispose);
      final repository = SessionCartRepository(
        guest,
        AccountCartApi(createApiClient(Uri.parse('http://localhost:4000'))),
        unknown,
      )..start();
      addTearDown(repository.dispose);
      await guest.restore();

      expect(unknown.status, SessionStatus.unknown);
      expect(repository.state, same(guest.state));
    });

    test(
      'anonymous delega as ações e repassa os avisos do visitante',
      () async {
        await build();
        await guest.restore();
        repository.start();
        await pumpEventQueue();
        expect(repository.state, same(guest.state));
        notifications = 0;
        emitted.clear();
        guestAdapter.enqueueResponse(body: previewWithLine(canetaLineJson));

        expect(await repository.add(_a, 2), isA<Ok<void>>());
        await pumpEventQueue();

        expect(guest.state.items, [_item(_a, 2)]);
        expect(repository.state, same(guest.state));
        expect(repository.state.count, 2);
        expect(notifications, greaterThanOrEqualTo(2));
        expect(emitted.last, same(guest.state));
        expect(emitted.last.lines.single.productId, _a);
        expect(guestAdapter.requests.single.path, '/cart/preview');
        expect(accountAdapter.requests, isEmpty);

        expect(await repository.remove(_a), isA<Ok<void>>());
        expect(guest.state.items, isEmpty);
      },
    );

    test(
      'entrar sem itens locais faz só GET /me/cart e mostra a conta',
      () async {
        await build();
        repository.start();
        await pumpEventQueue();
        final gate = accountAdapter.hold();
        accountAdapter.enqueueResponse(body: cartPreviewJson);
        notifications = 0;

        session.emit(auth.ana);

        expect(repository.state.isRestoring, isTrue);
        expect(repository.state.isEmpty, isTrue);
        expect(notifications, 1);

        await pumpEventQueue();
        expect(accountCalls(), ['GET /me/cart']);
        expect(repository.state.isRestoring, isTrue);

        gate.complete();
        await pumpEventQueue();

        expect(accountCalls(), ['GET /me/cart']);
        expect(guestAdapter.requests, isEmpty);
        expect(repository.state.isRestoring, isFalse);
        expect(repository.state.isSyncing, isFalse);
        expect(repository.state.items, [_item(_a, 2), _item(_b, 1)]);
        expect(repository.state.count, 3);
        expect(repository.state.lines.map((line) => line.productId), [_a, _b]);
        expect(emitted.last.count, 3);
      },
    );

    test('abrir já com sessão carrega a conta no start', () async {
      await build();
      session.emit(auth.ana);
      accountAdapter.enqueueResponse(body: previewWithLine(canetaLineJson));

      repository.start();
      await pumpEventQueue();

      expect(accountCalls(), ['GET /me/cart']);
      expect(repository.state.quantityOf(_a), 2);
    });

    test('aviso repetido com o mesmo token não recarrega', () async {
      await build();
      repository.start();
      accountAdapter.enqueueResponse(body: cartPreviewJson);
      session.emit(auth.ana);
      await pumpEventQueue();
      notifications = 0;

      session.emit(auth.ana);
      repository.start();
      await pumpEventQueue();

      expect(accountCalls(), ['GET /me/cart']);
      expect(notifications, 0);
      expect(repository.state.count, 3);
    });
  });

  group('saída', () {
    Future<void> signedIn() async {
      await build();
      repository.start();
      accountAdapter.enqueueResponse(body: cartPreviewJson);
      session.emit(auth.ana);
      await pumpEventQueue();
      expect(repository.state.count, 3);
    }

    test('sair volta ao visitante vazio, sem DELETE /me/cart', () async {
      await signedIn();
      notifications = 0;

      session.emit(null);
      await pumpEventQueue();

      expect(repository.state, same(guest.state));
      expect(repository.state.isEmpty, isTrue);
      expect(repository.state.count, 0);
      expect(notifications, 1);
      expect(emitted.last.isEmpty, isTrue);
      expect(accountCalls(), ['GET /me/cart']);
    });

    test('entrar de novo recarrega o carrinho da conta', () async {
      await signedIn();
      session.emit(null);
      await pumpEventQueue();
      accountAdapter.enqueueResponse(body: cartPreviewJson);

      session.emit(auth.ana);
      expect(repository.state.isRestoring, isTrue);
      await pumpEventQueue();

      expect(accountCalls(), ['GET /me/cart', 'GET /me/cart']);
      expect(repository.state.count, 3);
    });

    test('resposta da conta que chega depois de sair é descartada', () async {
      await build();
      await guest.restore();
      repository.start();
      final gate = accountAdapter.hold();
      accountAdapter.enqueueResponse(body: cartPreviewJson);
      session.emit(auth.ana);
      await pumpEventQueue();
      expect(accountCalls(), ['GET /me/cart']);

      session.emit(null);
      await pumpEventQueue();
      notifications = 0;
      emitted.clear();
      gate.complete();
      await pumpEventQueue();

      expect(repository.state, same(guest.state));
      expect(repository.state.isEmpty, isTrue);
      expect(repository.state.isRestoring, isFalse);
      expect(notifications, 0);
      expect(emitted, isEmpty);
    });

    test('trocar de token recarrega o carrinho', () async {
      await signedIn();
      accountAdapter.enqueueResponse(body: previewWithLine(canetaLineJson));

      session.switchToken('outro-token');
      expect(repository.state.isRestoring, isTrue);
      await pumpEventQueue();

      expect(accountCalls(), ['GET /me/cart', 'GET /me/cart']);
      expect(repository.state.items, [_item(_a, 2)]);
    });
  });

  group('carga com falha', () {
    test('500 preenche previewFailure com o detail vazio', () async {
      await build();
      repository.start();
      accountAdapter
        ..enqueueResponse(statusCode: 500, body: {'statusCode': 500})
        ..enqueueResponse(body: cartPreviewJson);
      session.emit(auth.ana);
      await pumpEventQueue();

      expect(repository.state.previewFailure, isA<ServerFailure>());
      expect(repository.state.isRestoring, isFalse);
      expect(repository.state.detail, CartDetail.empty());
      expect(repository.state.isEmpty, isTrue);

      repository.refresh();
      await pumpEventQueue();

      expect(accountCalls(), ['GET /me/cart', 'GET /me/cart']);
      expect(repository.state.previewFailure, isNull);
      expect(repository.state.count, 3);
    });

    test('refresh mantém a falha até a resposta chegar', () async {
      await build();
      repository.start();
      accountAdapter.enqueueResponse(
        statusCode: 500,
        body: {'statusCode': 500},
      );
      session.emit(auth.ana);
      await pumpEventQueue();
      final gate = accountAdapter.hold();
      accountAdapter.enqueueResponse(body: cartPreviewJson);

      repository.refresh();
      await pumpEventQueue();
      expect(repository.state.previewFailure, isNotNull);

      gate.complete();
      await pumpEventQueue();
      expect(repository.state.previewFailure, isNull);
    });
  });

  /// Entra na conta com o carrinho [cart] já carregado por `GET /me/cart` e
  /// zera as requisições, os avisos e os estados emitidos.
  Future<void> signedInWith(Map<String, Object?> cart) async {
    await build();
    repository.start();
    accountAdapter.enqueueResponse(body: cart);
    session.emit(auth.ana);
    await pumpEventQueue();
    accountAdapter.requests.clear();
    notifications = 0;
    emitted.clear();
  }

  group('comandos', () {
    test('add muda count e quantityOf antes da resposta', () async {
      await signedInWith(cartPreviewJson);
      final gate = accountAdapter.hold();
      accountAdapter.enqueueResponse(body: _canetaCart(3));

      final result = repository.add(_a.toUpperCase(), 1);

      expect(repository.state.quantityOf(_a), 3);
      expect(repository.state.count, 4);
      expect(repository.state.isSyncing, isTrue);
      expect(notifications, 1);

      await pumpEventQueue();
      expect(emitted.last.count, 4);
      expect(accountCalls(), ['POST /me/cart/items']);
      expect(accountAdapter.requests.single.data, {
        'productId': _a,
        'quantity': 1,
      });

      gate.complete();
      expect(await result, isA<Ok<void>>());
      await pumpEventQueue();

      expect(repository.state.isSyncing, isFalse);
      expect(repository.state.items, [_item(_a, 3)]);
      expect(repository.state.count, 3);
    });

    test('setQuantity envia PUT com {quantity}', () async {
      await signedInWith(cartPreviewJson);
      accountAdapter.enqueueResponse(body: _canetaCart(5));

      final result = repository.setQuantity(_a, 5);
      expect(repository.state.quantityOf(_a), 5);

      expect(await result, isA<Ok<void>>());
      expect(accountCalls(), ['PUT /me/cart/items/$_a']);
      expect(accountAdapter.requests.single.data, {'quantity': 5});
    });

    test('setQuantity(id, 0) e remove enviam DELETE', () async {
      await signedInWith(cartPreviewJson);
      accountAdapter
        ..enqueueResponse(body: previewWithLine(unavailableLineJson))
        ..enqueueResponse(body: emptyCartPreviewJson);

      final zero = repository.setQuantity(_a, 0);
      final removed = repository.remove(_b);

      expect(repository.state.quantityOf(_a), 0);
      expect(repository.state.quantityOf(_b), 0);
      expect(repository.state.count, 0);

      expect(await zero, isA<Ok<void>>());
      expect(await removed, isA<Ok<void>>());
      await pumpEventQueue();

      expect(accountCalls(), [
        'DELETE /me/cart/items/$_a',
        'DELETE /me/cart/items/$_b',
      ]);
      expect(repository.state.isEmpty, isTrue);
    });

    test('clear envia DELETE /me/cart', () async {
      await signedInWith(cartPreviewJson);
      accountAdapter.enqueueResponse(body: emptyCartPreviewJson);

      final result = repository.clear();
      expect(repository.state.count, 0);

      expect(await result, isA<Ok<void>>());
      await pumpEventQueue();

      expect(accountCalls(), ['DELETE /me/cart']);
      expect(repository.state.isEmpty, isTrue);
      expect(repository.state.detail, CartDetail.empty());
    });
  });

  group('fila', () {
    test('mudança na hora e em ordem', () async {
      await signedInWith(_canetaCart(2));
      final first = accountAdapter.hold();
      // A última resposta difere do override (outro aparelho somou uma
      // unidade), para provar que os overrides somem no fim da fila.
      accountAdapter
        ..enqueueResponse(body: _canetaCart(3))
        ..enqueueResponse(body: _canetaCart(5));

      final plusOne = repository.setQuantity(_a, 3);
      final plusTwo = repository.setQuantity(_a, 4);

      expect(repository.state.quantityOf(_a), 4);
      expect(repository.state.count, 4);
      expect(repository.state.isSyncing, isTrue);

      await pumpEventQueue();
      expect(accountCalls(), ['PUT /me/cart/items/$_a']);
      expect(accountAdapter.requests.single.data, {'quantity': 3});

      final second = accountAdapter.hold();
      first.complete();
      expect(await plusOne, isA<Ok<void>>());
      await pumpEventQueue();

      expect(accountCalls(), [
        'PUT /me/cart/items/$_a',
        'PUT /me/cart/items/$_a',
      ]);
      expect(accountAdapter.requests.last.data, {'quantity': 4});
      expect(repository.state.quantityOf(_a), 4);
      expect(repository.state.isSyncing, isTrue);

      second.complete();
      expect(await plusTwo, isA<Ok<void>>());
      await pumpEventQueue();

      expect(repository.state.isSyncing, isFalse);
      expect(repository.state.items, [_item(_a, 5)]);
      expect(repository.state.detail.itemCount, 5);
      expect(emitted.last.quantityOf(_a), 5);
    });
  });

  group('recusas', () {
    test('regra local devolve ValidationFailure sem requisição', () async {
      await signedInWith(_canetaCart(98));

      final result = await repository.add(_a, 3);

      expect(result, isA<Failure<void>>());
      final failure = (result as Failure<void>).failure;
      expect(failure, isA<ValidationFailure>());
      expect(failure.message, 'Limite de 99 unidades por produto.');
      await pumpEventQueue();
      expect(accountAdapter.requests, isEmpty);
      expect(notifications, 0);
      expect(repository.state.quantityOf(_a), 98);
      expect(repository.state.isSyncing, isFalse);
    });

    test('404 devolve "Produto indisponível." e recarrega', () async {
      await signedInWith(cartPreviewJson);
      accountAdapter
        ..enqueueResponse(statusCode: 404, body: productNotFoundJson)
        ..enqueueResponse(body: cartPreviewJson);

      final pending = repository.add(_c, 1);
      expect(repository.state.count, 4);

      final result = await pending;
      expect(result, isA<Failure<void>>());
      final failure = (result as Failure<void>).failure;
      expect(failure, isA<NotFoundFailure>());
      expect(failure.message, 'Produto indisponível.');
      await pumpEventQueue();

      expect(accountCalls(), ['POST /me/cart/items', 'GET /me/cart']);
      expect(repository.state.count, 3);
      expect(repository.state.quantityOf(_c), 0);
      expect(repository.state.isSyncing, isFalse);
    });

    test('401 devolve SessionFailure sem recarga', () async {
      await signedInWith(cartPreviewJson);
      accountAdapter.enqueueResponse(
        statusCode: 401,
        body: {'statusCode': 401},
      );

      final result = await repository.setQuantity(_a, 3);
      await pumpEventQueue();

      expect(result, isA<Failure<void>>());
      expect((result as Failure<void>).failure, isA<SessionFailure>());
      expect(accountCalls(), ['PUT /me/cart/items/$_a']);
      expect(repository.state.isSyncing, isFalse);
      expect(repository.state.quantityOf(_a), 2);
    });
  });

  group('mescla', () {
    /// Merge de A (3) e B (1) numa conta que já tinha A (2): A 5 e B 1.
    final mergedJson = previewWith('lines', <Object?>[
      {...canetaLineJson, 'quantity': 5, 'lineTotalCents': 6450},
      unavailableLineJson,
    ]);

    Future<void> signInWithGuestItems() async {
      await build(guestItems: [_item(_a, 3), _item(_b, 1)]);
      // Prévia que o restore do visitante pode pedir; inofensiva.
      guestAdapter.enqueueResponse(body: cartPreviewJson);
      repository.start();
      session.emit(auth.ana);
    }

    test('entrar com itens do visitante mescla sem GET', () async {
      await signInWithGuestItems();
      accountAdapter.enqueueResponse(body: mergedJson);
      await pumpEventQueue();

      expect(accountCalls(), ['POST /me/cart/merge']);
      expect(accountAdapter.requests.single.data, {
        'items': [
          {'productId': _a, 'quantity': 3},
          {'productId': _b, 'quantity': 1},
        ],
      });
      expect(store.values.containsKey(GuestCartStorage.storageKey), isFalse);
      expect(guest.state.items, isEmpty);
      expect(repository.state.items, [_item(_a, 5), _item(_b, 1)]);
      expect(repository.state.mergeFailure, isNull);
      expect(repository.state.isRestoring, isFalse);
    });

    test('falha na mescla carrega a conta e mantém os itens locais', () async {
      await signInWithGuestItems();
      accountAdapter
        ..enqueueResponse(statusCode: 500, body: {'statusCode': 500})
        ..enqueueResponse(body: _canetaCart(2));
      await pumpEventQueue();

      expect(accountCalls(), ['POST /me/cart/merge', 'GET /me/cart']);
      expect(repository.state.mergeFailure, isA<ServerFailure>());
      expect(repository.state.previewFailure, isNull);
      expect(repository.state.items, [_item(_a, 2)]);
      expect(store.values.containsKey(GuestCartStorage.storageKey), isTrue);
      expect(await guest.pendingItems(), [_item(_a, 3), _item(_b, 1)]);

      accountAdapter.enqueueResponse(body: mergedJson);
      repository.refresh();
      expect(repository.state.mergeFailure, isNotNull);
      await pumpEventQueue();

      expect(accountCalls(), [
        'POST /me/cart/merge',
        'GET /me/cart',
        'POST /me/cart/merge',
      ]);
      expect(repository.state.mergeFailure, isNull);
      expect(repository.state.items, [_item(_a, 5), _item(_b, 1)]);
      expect(store.values.containsKey(GuestCartStorage.storageKey), isFalse);
      expect(guest.state.items, isEmpty);
    });
  });
}
