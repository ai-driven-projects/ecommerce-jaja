import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/infra/http/api_client.dart';
import 'package:mobile/infra/http/auth_interceptor.dart';
import 'package:mobile/infra/order/api_order_live_source.dart';
import 'package:mobile/modules/order/provider/order_live_source.dart';

import '../http/support/fake_http_client_adapter.dart';

void main() {
  late FakeHttpClientAdapter adapter;
  late ApiOrderLiveSource source;
  late StreamController<Uint8List> body;
  late int unauthorizedCalls;

  setUp(() {
    adapter = FakeHttpClientAdapter();
    body = StreamController<Uint8List>();
    unauthorizedCalls = 0;
    final dio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = adapter
      ..interceptors.add(
        AuthInterceptor(
          readToken: () => 'abc',
          onUnauthorized: () => unauthorizedCalls++,
        ),
      );
    source = ApiOrderLiveSource(dio);
  });

  Uint8List bytes(String text) => Uint8List.fromList(utf8.encode(text));

  const orderEvent =
      'event: order\n'
      'data: {"orderId":"o-1","eventType":"PICKING"}\n'
      '\n';

  Future<_Listener> listen([String orderId = 'o-1']) async {
    final listener = _Listener(source.open(orderId));
    await pumpEventQueue();
    return listener;
  }

  group('requisição', () {
    test(
      'GET /me/orders/<id codificado>/stream com Accept: '
      'text/event-stream, ResponseType.stream e receiveTimeout zero',
      () async {
        adapter.enqueueStream(body.stream);

        await listen('o 1/ç');

        final request = adapter.requests.single;
        expect(request.method, 'GET');
        expect(request.path, '/me/orders/o%201%2F%C3%A7/stream');
        expect(request.headers[Headers.acceptHeader], 'text/event-stream');
        expect(request.responseType, ResponseType.stream);
        expect(request.receiveTimeout, Duration.zero);
      },
    );

    test('o token vai no cabeçalho, nunca na URL', () async {
      adapter.enqueueStream(body.stream);

      await listen();

      final request = adapter.requests.single;
      expect(request.headers['Authorization'], 'Bearer abc');
      expect(request.uri.toString(), isNot(contains('abc')));
    });

    test('nada sai antes de alguém assinar', () async {
      source.open('o-1');
      await pumpEventQueue();

      expect(adapter.requests, isEmpty);
    });
  });

  group('eventos', () {
    test('200 vira Opened', () async {
      adapter.enqueueStream(body.stream);

      final listener = await listen();

      expect(listener.signals, [isA<OrderStreamOpened>()]);
      expect(listener.isDone, isFalse);
    });

    test('evento order vira Notice', () async {
      adapter.enqueueStream(body.stream);
      final listener = await listen();

      body
        ..add(bytes(orderEvent))
        ..add(bytes(orderEvent));
      await pumpEventQueue();

      expect(listener.signals, [
        isA<OrderStreamOpened>(),
        isA<OrderStreamNotice>(),
        isA<OrderStreamNotice>(),
      ]);
    });

    test('ping e evento de outro nome são ignorados', () async {
      adapter.enqueueStream(body.stream);
      final listener = await listen();

      body
        ..add(bytes('event: ping\ndata: {}\n\n'))
        ..add(bytes('event: outro\ndata: {"n":1}\n\n'))
        ..add(bytes('data: {"n":2}\n\n'));
      await pumpEventQueue();

      expect(listener.signals, [isA<OrderStreamOpened>()]);
      expect(listener.isDone, isFalse);
    });

    test('"ç" partido entre dois pedaços chega inteiro', () async {
      adapter.enqueueStream(body.stream);
      final listener = await listen();
      final event = bytes('event: order\ndata: {"nome":"Açaí"}\n\n');
      final cut = utf8.encode('event: order\ndata: {"nome":"A').length + 1;

      body
        ..add(Uint8List.sublistView(event, 0, cut))
        ..add(Uint8List.sublistView(event, cut));
      await pumpEventQueue();

      expect(listener.signals, [
        isA<OrderStreamOpened>(),
        isA<OrderStreamNotice>(),
      ]);
      expect(listener.errors, isEmpty);
    });
  });

  group('recusa', () {
    test('401 vira Refused com SessionFailure e o stream termina', () async {
      adapter.enqueueResponse(statusCode: 401, body: {'statusCode': 401});

      final listener = await listen();

      expect(listener.signals, [
        isA<OrderStreamRefused>().having(
          (signal) => signal.failure,
          'failure',
          isA<SessionFailure>(),
        ),
      ]);
      expect(listener.isDone, isTrue);
      expect(listener.errors, isEmpty);
      expect(unauthorizedCalls, 1);
    });

    test('403 vira Refused com BackendRejectionFailure e o stream '
        'termina', () async {
      adapter.enqueueResponse(statusCode: 403, body: {'statusCode': 403});

      final listener = await listen();

      expect(listener.signals, [
        isA<OrderStreamRefused>().having(
          (signal) => signal.failure,
          'failure',
          isA<BackendRejectionFailure>().having(
            (failure) => failure.statusCode,
            'statusCode',
            403,
          ),
        ),
      ]);
      expect(listener.isDone, isTrue);
    });

    test('404 vira Refused com NotFoundFailure e o stream termina', () async {
      adapter.enqueueResponse(
        statusCode: 404,
        body: {
          'statusCode': 404,
          'message': ['ORDER_NOT_FOUND'],
        },
      );

      final listener = await listen();

      expect(listener.signals, [
        isA<OrderStreamRefused>().having(
          (signal) => signal.failure,
          'failure',
          isA<NotFoundFailure>(),
        ),
      ]);
      expect(listener.isDone, isTrue);
    });
  });

  group('queda', () {
    test('500 termina sem Refused e sem erro', () async {
      adapter.enqueueResponse(statusCode: 500, body: {'statusCode': 500});

      final listener = await listen();

      expect(listener.signals, isEmpty);
      expect(listener.isDone, isTrue);
      expect(listener.errors, isEmpty);
    });

    test('erro de rede termina sem Refused e sem erro', () async {
      adapter.enqueueError(DioExceptionType.connectionError);

      final listener = await listen();

      expect(listener.signals, isEmpty);
      expect(listener.isDone, isTrue);
      expect(listener.errors, isEmpty);
    });

    test('fim do corpo termina sem Refused e sem erro', () async {
      adapter.enqueueStream(body.stream);
      final listener = await listen();

      body.add(bytes(orderEvent));
      await body.close();
      await pumpEventQueue();

      expect(listener.signals, [
        isA<OrderStreamOpened>(),
        isA<OrderStreamNotice>(),
      ]);
      expect(listener.isDone, isTrue);
      expect(listener.errors, isEmpty);
    });

    test('erro no meio do corpo termina sem Refused e sem erro', () async {
      adapter.enqueueStream(body.stream);
      final listener = await listen();

      body.addError(const SocketExceptionStub());
      await pumpEventQueue();

      expect(listener.signals, [isA<OrderStreamOpened>()]);
      expect(listener.isDone, isTrue);
      expect(listener.errors, isEmpty);
    });
  });

  group('cancelamento', () {
    test('cancelar a assinatura completa o cancelFuture e solta o '
        'corpo', () async {
      adapter.enqueueStream(body.stream);
      final listener = await listen();

      await listener.cancel();
      await pumpEventQueue();

      await expectLater(adapter.cancelFutures.single, completes);
      expect(body.hasListener, isFalse);
    });

    test('cancelar logo ao assinar não emite nada nem erro', () async {
      adapter.enqueueStream(body.stream);
      final listener = _Listener(source.open('o-1'));

      await listener.cancel();
      await pumpEventQueue();

      expect(listener.signals, isEmpty);
      expect(listener.errors, isEmpty);
      expect(body.hasListener, isFalse);
    });
  });
}

/// Erro qualquer vindo da rede no meio do corpo.
class SocketExceptionStub implements Exception {
  const SocketExceptionStub();
}

class _Listener {
  _Listener(Stream<OrderStreamSignal> stream) {
    _subscription = stream.listen(
      signals.add,
      onError: (Object error) => errors.add(error),
      onDone: () => isDone = true,
    );
  }

  final List<OrderStreamSignal> signals = [];
  final List<Object> errors = [];
  bool isDone = false;
  late final StreamSubscription<OrderStreamSignal> _subscription;

  Future<void> cancel() => _subscription.cancel();
}
