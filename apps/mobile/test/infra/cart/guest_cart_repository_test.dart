import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/money.dart';
import 'package:mobile/infra/cart/guest_cart_repository.dart';
import 'package:mobile/infra/cart/guest_cart_storage.dart';
import 'package:mobile/infra/http/api_client.dart';
import 'package:mobile/modules/cart/errors/cart_errors.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/modules/cart/model/cart_state.dart';

import '../api/support/cart_json.dart';
import '../http/support/fake_http_client_adapter.dart';
import '../storage/support/fake_key_value_store.dart';

const _key = GuestCartStorage.storageKey;
const _a = '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e20';
const _b = '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e21';

CartItem _item(String productId, int quantity) =>
    CartItem(productId: productId, quantity: quantity);

String _stored(List<CartItem> items) => jsonEncode([
  for (final item in items)
    {'productId': item.productId, 'quantity': item.quantity},
]);

/// Linha de A (a caneta) com a [quantity] e o preço [priceCents].
Map<String, Object?> _lineA({int quantity = 2, int priceCents = 1290}) => {
  ...canetaLineJson,
  'priceCents': priceCents,
  'quantity': quantity,
  'lineTotalCents': priceCents * quantity,
};

/// Prévia com [lines], totais coerentes e entrega cobrada abaixo de 7900.
Map<String, Object?> _preview(List<Map<String, Object?>> lines) {
  final subtotal = lines.fold<int>(
    0,
    (sum, line) => sum + (line['lineTotalCents'] as int? ?? 0),
  );
  final fee = subtotal == 0 || subtotal >= 7900 ? 0 : 490;
  return {
    'lines': lines,
    'itemCount': lines.fold<int>(
      0,
      (sum, line) => sum + (line['quantity'] as int),
    ),
    'subtotalCents': subtotal,
    'deliveryFeeCents': fee,
    'totalCents': subtotal + fee,
    'freeDeliveryThresholdCents': 7900,
    'missingForFreeDeliveryCents': fee == 0 ? 0 : 7900 - subtotal,
    'hasUnavailableItems': false,
  };
}

Money _money(int cents) => (Money.fromCents(cents) as Ok<Money>).value;

/// [FakeKeyValueStore] cuja leitura só termina com [release].
class _SlowKeyValueStore extends FakeKeyValueStore {
  _SlowKeyValueStore({super.initialValues});

  final Completer<void> _gate = Completer();

  void release() => _gate.complete();

  @override
  Future<String?> readString(String key) async {
    await _gate.future;
    return super.readString(key);
  }
}

/// [FakeHttpClientAdapter] que segura a próxima resposta até o [gate]
/// atribuído ser completado.
class _HoldingHttpClientAdapter extends FakeHttpClientAdapter {
  Completer<void>? gate;

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

void main() {
  late _HoldingHttpClientAdapter adapter;
  late FakeKeyValueStore store;
  late GuestCartRepository repository;
  late int notifications;
  late List<CartState> emitted;

  /// Monta o repositório sobre [values] guardados (ou [slowStore]).
  void build({
    Map<String, String> values = const {},
    Duration previewDelay = Duration.zero,
    FakeKeyValueStore? slowStore,
  }) {
    adapter = _HoldingHttpClientAdapter();
    store = slowStore ?? FakeKeyValueStore(initialValues: values);
    final dio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = adapter;
    repository = GuestCartRepository(
      dio,
      GuestCartStorage(store),
      previewDelay: previewDelay,
    );
    notifications = 0;
    repository.addListener(() => notifications++);
    emitted = [];
    repository.changes.listen(emitted.add);
  }

  String? authorizationOf(RequestOptions request) => request.headers.entries
      .where((entry) => entry.key.toLowerCase() == 'authorization')
      .map((entry) => entry.value as String?)
      .firstOrNull;

  List<CartItem> storedItems() {
    final raw = store.values[_key];
    if (raw == null) return const [];
    return [
      for (final entry
          in (jsonDecode(raw) as List<Object?>).cast<Map<String, Object?>>())
        _item(entry['productId']! as String, entry['quantity']! as int),
    ];
  }

  Object? quantitiesOf(RequestOptions request) =>
      (request.data as Map<String, Object?>)['items'];

  group('restore', () {
    tearDown(() => repository.dispose());

    test('nasce isRestoring, sem itens', () {
      build();

      expect(repository.state.isRestoring, isTrue);
      expect(repository.state.items, isEmpty);
    });

    test('carrinho guardado vazio não chama a API', () async {
      build();

      await repository.restore();
      await pumpEventQueue();

      expect(repository.state.isRestoring, isFalse);
      expect(repository.state.isSyncing, isFalse);
      expect(repository.state.detail, CartDetail.empty());
      expect(adapter.requests, isEmpty);
      expect(notifications, 1);
      expect(emitted, hasLength(1));
    });

    test(
      'com itens pede a prévia com {"items": …}, sem Authorization',
      () async {
        build(
          values: {
            _key: _stored([_item(_a, 2)]),
          },
        );
        adapter.enqueueResponse(body: _preview([_lineA()]));

        await repository.restore();
        expect(repository.state.isRestoring, isFalse);
        expect(repository.state.items, [_item(_a, 2)]);
        expect(repository.state.isSyncing, isTrue);
        expect(repository.state.awaitsFirstPreview, isTrue);

        await pumpEventQueue();

        final request = adapter.requests.single;
        expect(request.method, 'POST');
        expect(request.path, '/cart/preview');
        expect(request.data, {
          'items': [
            {'productId': _a, 'quantity': 2},
          ],
        });
        expect(authorizationOf(request), isNull);
        expect(repository.state.isSyncing, isFalse);
        expect(repository.state.lines.single.productId, _a);
        expect(repository.state.detail.subtotal, _money(2580));
      },
    );

    test('lê o aparelho uma vez só', () async {
      build();

      await Future.wait([repository.restore(), repository.restore()]);

      expect(notifications, 1);
    });

    test('ação feita antes do fim do restore espera por ele', () async {
      final slow = _SlowKeyValueStore(
        initialValues: {
          _key: _stored([_item(_a, 2)]),
        },
      );
      build(slowStore: slow);
      adapter.enqueueResponse(body: _preview([_lineA(quantity: 3)]));

      unawaited(repository.restore());
      final adding = repository.add(_a, 1);
      await pumpEventQueue();
      expect(repository.state.isRestoring, isTrue);
      expect(repository.state.items, isEmpty);

      slow.release();
      expect(await adding, isA<Ok<void>>());
      expect(repository.state.items, [_item(_a, 3)]);
      expect(storedItems(), [_item(_a, 3)]);

      await pumpEventQueue();
      expect(quantitiesOf(adapter.requests.single), [
        {'productId': _a, 'quantity': 3},
      ]);
    });
  });

  group('mudanças', () {
    setUp(() async {
      build();
      await repository.restore();
      await pumpEventQueue();
      notifications = 0;
      emitted.clear();
    });

    tearDown(() => repository.dispose());

    test('add muda count, grava e avisa antes da resposta', () async {
      final gate = Completer<void>();
      adapter
        ..gate = gate
        ..enqueueResponse(body: _preview([_lineA()]));

      expect(await repository.add(_a, 2), isA<Ok<void>>());
      await pumpEventQueue();

      // A prévia saiu, mas a resposta ainda não chegou.
      expect(adapter.requests, hasLength(1));
      expect(repository.state.count, 2);
      expect(repository.state.isSyncing, isTrue);
      expect(notifications, 1);
      expect(emitted.single.count, 2);
      expect(storedItems(), [_item(_a, 2)]);

      gate.complete();
      await pumpEventQueue();
      expect(repository.state.isSyncing, isFalse);
      expect(notifications, 2);
    });

    test('add aceita o id com espaços e maiúsculas', () async {
      await repository.add(' ${_a.toUpperCase()} ', 1);

      expect(repository.state.items, [_item(_a, 1)]);
    });

    test(
      'falha de regra devolve a ValidationFailure sem gravar nem avisar',
      () async {
        adapter.enqueueResponse(body: _preview([_lineA(quantity: 98)]));
        await repository.add(_a, 98);
        await pumpEventQueue();
        notifications = 0;
        emitted.clear();
        final before = store.values[_key];

        final result = await repository.add(_a, 3);

        final failure = (result as Failure<void>).failure;
        expect(failure, isA<ValidationFailure>());
        expect(failure.code, CartErrorCode.quantityExceeded);
        expect(failure.message, 'Limite de 99 unidades por produto.');
        expect(repository.state.quantityOf(_a), 98);
        expect(store.values[_key], before);
        expect(notifications, 0);
        expect(emitted, isEmpty);
      },
    );

    test('quantidade inválida ao incluir não muda nada', () async {
      final result = await repository.add(_a, 0);

      expect(
        (result as Failure<void>).failure.code,
        CartErrorCode.quantityInvalid,
      );
      expect(repository.state.items, isEmpty);
      expect(store.values.containsKey(_key), isFalse);
      expect(notifications, 0);
    });

    test('setQuantity 0 tira o item e apaga a chave', () async {
      await repository.add(_a, 2);

      expect(await repository.setQuantity(_a, 0), isA<Ok<void>>());

      expect(repository.state.items, isEmpty);
      expect(store.values.containsKey(_key), isFalse);
      await pumpEventQueue();
      expect(adapter.requests, isEmpty);
    });

    test('setQuantity define a quantidade na mesma posição', () async {
      await repository.add(_a, 2);
      await repository.add(_b, 1);

      await repository.setQuantity(_a, 5);

      expect(repository.state.items, [_item(_a, 5), _item(_b, 1)]);
      expect(storedItems(), [_item(_a, 5), _item(_b, 1)]);
    });

    test('remove tira o item, grava e devolve Ok', () async {
      await repository.add(_a, 2);
      await repository.add(_b, 1);
      notifications = 0;

      expect(await repository.remove(_a), isA<Ok<void>>());

      expect(repository.state.items, [_item(_b, 1)]);
      expect(storedItems(), [_item(_b, 1)]);
      expect(notifications, 1);
    });
  });

  group('prévia com atraso', () {
    testWidgets('três mudanças em menos de 250 ms fazem um pedido só', (
      tester,
    ) async {
      build(previewDelay: const Duration(milliseconds: 250));
      addTearDown(repository.dispose);
      await repository.restore();
      adapter.enqueueResponse(body: _preview([_lineA(quantity: 3)]));

      await repository.add(_a, 1);
      await tester.pump(const Duration(milliseconds: 100));
      await repository.add(_a, 1);
      await tester.pump(const Duration(milliseconds: 100));
      await repository.add(_a, 1);
      await tester.pump(const Duration(milliseconds: 249));
      expect(adapter.requests, isEmpty);

      await tester.pump(const Duration(milliseconds: 1));
      await tester.pump();
      expect(quantitiesOf(adapter.requests.single), [
        {'productId': _a, 'quantity': 3},
      ]);

      await tester.pump(const Duration(seconds: 1));
      expect(adapter.requests, hasLength(1));
      expect(repository.state.isSyncing, isFalse);
      expect(repository.state.lines.single.quantity, 3);
    });

    testWidgets('resposta de geração antiga é descartada', (tester) async {
      build(previewDelay: const Duration(milliseconds: 250));
      addTearDown(repository.dispose);
      await repository.restore();
      final gate = Completer<void>();
      adapter
        ..gate = gate
        ..enqueueResponse(body: _preview([_lineA(quantity: 1)]))
        ..enqueueResponse(body: _preview([_lineA(quantity: 2)]));

      await repository.add(_a, 1);
      await tester.pump(const Duration(milliseconds: 250));
      expect(adapter.requests, hasLength(1));

      // Outra mudança antes de a primeira resposta chegar.
      await repository.add(_a, 1);
      gate.complete();
      await tester.pump();
      expect(repository.state.isSyncing, isTrue);
      expect(repository.state.detail, CartDetail.empty());

      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(adapter.requests, hasLength(2));
      expect(quantitiesOf(adapter.requests.last), [
        {'productId': _a, 'quantity': 2},
      ]);
      expect(repository.state.isSyncing, isFalse);
      expect(repository.state.detail.lines.single.quantity, 2);
    });

    testWidgets('esvaziar não chama a API e zera o detail', (tester) async {
      build(previewDelay: const Duration(milliseconds: 250));
      addTearDown(repository.dispose);
      await repository.restore();
      adapter.enqueueResponse(body: _preview([_lineA(quantity: 1)]));
      await repository.add(_a, 1);
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(repository.state.detail.lines, hasLength(1));

      await repository.remove(_a);
      await tester.pump(const Duration(seconds: 1));

      expect(adapter.requests, hasLength(1));
      expect(repository.state.detail, CartDetail.empty());
      expect(repository.state.isSyncing, isFalse);
      expect(repository.state.isEmpty, isTrue);
    });
  });

  group('itens que somem ou mudam de preço', () {
    tearDown(() => repository.dispose());

    test(
      'prévia sem a linha de B tira B do estado e do armazenamento',
      () async {
        build(
          values: {
            _key: _stored([_item(_a, 2), _item(_b, 1)]),
          },
        );
        adapter.enqueueResponse(body: _preview([_lineA()]));

        await repository.restore();
        await pumpEventQueue();

        expect(quantitiesOf(adapter.requests.single), [
          {'productId': _a, 'quantity': 2},
          {'productId': _b, 'quantity': 1},
        ]);
        expect(repository.state.items, [_item(_a, 2)]);
        expect(repository.state.count, 2);
        expect(repository.state.lines.map((line) => line.productId), [_a]);
        expect(storedItems(), [_item(_a, 2)]);
      },
    );

    test('prévia com o id em maiúsculas mantém o item', () async {
      build(
        values: {
          _key: _stored([_item(_a, 2)]),
        },
      );
      adapter.enqueueResponse(
        body: _preview([
          {..._lineA(), 'productId': _a.toUpperCase()},
        ]),
      );

      await repository.restore();
      await pumpEventQueue();

      expect(repository.state.items, [_item(_a, 2)]);
      expect(repository.state.lines, hasLength(1));
    });

    test(
      'segunda prévia com preço novo atualiza a linha e o subtotal',
      () async {
        build(
          values: {
            _key: _stored([_item(_a, 2)]),
          },
        );
        adapter
          ..enqueueResponse(body: _preview([_lineA()]))
          ..enqueueResponse(body: _preview([_lineA(priceCents: 1490)]));
        await repository.restore();
        await pumpEventQueue();
        expect(repository.state.lines.single.price, _money(1290));
        expect(repository.state.detail.subtotal, _money(2580));

        repository.refresh();
        await pumpEventQueue();

        expect(repository.state.lines.single.price, _money(1490));
        expect(repository.state.detail.subtotal, _money(2980));
        expect(repository.state.detail.total, _money(3470));
      },
    );
  });

  group('falhas', () {
    tearDown(() => repository.dispose());

    test('500 preenche previewFailure e mantém os itens e o detail', () async {
      build(
        values: {
          _key: _stored([_item(_a, 2)]),
        },
      );
      adapter
        ..enqueueResponse(body: _preview([_lineA()]))
        ..enqueueResponse(statusCode: 500, body: {'statusCode': 500});
      await repository.restore();
      await pumpEventQueue();
      final detail = repository.state.detail;

      await repository.add(_a, 1);
      await pumpEventQueue();

      expect(repository.state.previewFailure, isA<ServerFailure>());
      expect(repository.state.isSyncing, isFalse);
      expect(repository.state.items, [_item(_a, 3)]);
      expect(storedItems(), [_item(_a, 3)]);
      expect(repository.state.detail, detail);
    });

    test('refresh pede na hora e limpa a falha no sucesso', () async {
      build(
        values: {
          _key: _stored([_item(_a, 2)]),
        },
        previewDelay: const Duration(hours: 1),
      );
      adapter
        ..enqueueResponse(statusCode: 500, body: {'statusCode': 500})
        ..enqueueResponse(body: _preview([_lineA()]));
      await repository.restore();
      repository.refresh();
      await pumpEventQueue();
      expect(repository.state.previewFailure, isNotNull);
      expect(repository.state.awaitsFirstPreview, isFalse);

      repository.refresh();
      await pumpEventQueue();

      expect(adapter.requests, hasLength(2));
      expect(repository.state.previewFailure, isNull);
      expect(repository.state.isSyncing, isFalse);
      expect(repository.state.lines.single.productId, _a);
    });
  });

  group('pendingItems e clear', () {
    tearDown(() => repository.dispose());

    test(
      'pendingItems espera o restore e devolve os itens guardados',
      () async {
        final slow = _SlowKeyValueStore(
          initialValues: {
            _key: _stored([_item(_a, 3), _item(_b, 1)]),
          },
        );
        build(slowStore: slow, previewDelay: const Duration(hours: 1));

        var done = false;
        final pending = repository.pendingItems()..then((_) => done = true);
        await pumpEventQueue();
        expect(done, isFalse);

        slow.release();

        expect(await pending, [_item(_a, 3), _item(_b, 1)]);
      },
    );

    test('pendingItems sem nada guardado devolve vazio', () async {
      build();

      expect(await repository.pendingItems(), isEmpty);
    });

    test('clear apaga a chave, zera o estado e avisa', () async {
      build(
        values: {
          _key: _stored([_item(_a, 2)]),
        },
      );
      adapter.enqueueResponse(body: _preview([_lineA()]));
      await repository.restore();
      await pumpEventQueue();
      expect(repository.state.lines, hasLength(1));
      notifications = 0;
      emitted.clear();

      expect(await repository.clear(), isA<Ok<void>>());

      expect(store.values.containsKey(_key), isFalse);
      expect(repository.state.items, isEmpty);
      expect(repository.state.detail, CartDetail.empty());
      expect(repository.state.isSyncing, isFalse);
      expect(repository.state.previewFailure, isNull);
      expect(notifications, 1);
      expect(emitted.single.isEmpty, isTrue);
      expect(await repository.pendingItems(), isEmpty);
    });

    test('clear descarta a prévia em curso e cancela a agendada', () async {
      build(
        values: {
          _key: _stored([_item(_a, 2)]),
        },
      );
      final gate = Completer<void>();
      adapter
        ..gate = gate
        ..enqueueResponse(body: _preview([_lineA()]));
      await repository.restore();
      await pumpEventQueue();
      expect(adapter.requests, hasLength(1));

      await repository.clear();
      gate.complete();
      await pumpEventQueue();

      expect(adapter.requests, hasLength(1));
      expect(repository.state.items, isEmpty);
      expect(repository.state.detail, CartDetail.empty());
      expect(store.values.containsKey(_key), isFalse);
    });
  });

  group('dispose', () {
    test('nada notifica depois do dispose', () async {
      build(
        values: {
          _key: _stored([_item(_a, 2)]),
        },
        previewDelay: const Duration(hours: 1),
      );
      await repository.restore();
      await pumpEventQueue();
      notifications = 0;
      emitted.clear();

      repository.dispose();
      await pumpEventQueue();

      expect(notifications, 0);
      expect(emitted, isEmpty);
      expect(adapter.requests, isEmpty);
    });

    test('resposta em andamento é descartada depois do dispose', () async {
      build(
        values: {
          _key: _stored([_item(_a, 2)]),
        },
      );
      final gate = Completer<void>();
      adapter
        ..gate = gate
        ..enqueueResponse(body: _preview([_lineA()]));
      await repository.restore();
      await pumpEventQueue();
      expect(adapter.requests, hasLength(1));
      notifications = 0;
      emitted.clear();

      repository.dispose();
      gate.complete();
      await pumpEventQueue();

      expect(notifications, 0);
      expect(emitted, isEmpty);
      expect(repository.state.detail, CartDetail.empty());
    });

    test('restore que termina depois do dispose não avisa', () async {
      final slow = _SlowKeyValueStore(
        initialValues: {
          _key: _stored([_item(_a, 2)]),
        },
      );
      build(slowStore: slow);
      final restoring = repository.restore();

      repository.dispose();
      slow.release();
      await restoring;
      await pumpEventQueue();

      expect(notifications, 0);
      expect(adapter.requests, isEmpty);
    });
  });
}
