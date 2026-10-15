import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../../modules/order/provider/order_live_source.dart';
import '../http/event_stream_parser.dart';
import '../http/http_failure_mapper.dart';

/// [OrderLiveSource] sobre `MyOrderController.stream`
/// (`GET /me/orders/:id/stream`), no papel do `fetch` de `openEventStream`
/// (`apps/frontend/src/shared/util/event-stream.util.ts`). O Bearer vai pelo
/// `AuthInterceptor`, no cabeçalho: o token nunca vai para a URL. A
/// reconexão não mora aqui: cada [open] é uma conexão só.
final class ApiOrderLiveSource implements OrderLiveSource {
  ApiOrderLiveSource(this._dio);

  final Dio _dio;

  static const _path = '/me/orders';

  @override
  Stream<OrderStreamSignal> open(String orderId) {
    return _OrderStreamConnection(
      _dio,
      '$_path/${Uri.encodeComponent(orderId)}/stream',
    ).signals;
  }
}

/// Uma conexão: abre no `listen` e fecha no `cancel` da assinatura. Nenhuma
/// exceção sai daqui; o stream termina depois de [OrderStreamRefused] ou sem
/// ele.
final class _OrderStreamConnection {
  _OrderStreamConnection(this._dio, this._path) {
    _signals = StreamController(onListen: _connect, onCancel: _cancel);
  }

  final Dio _dio;
  final String _path;
  final _cancelToken = CancelToken();
  late final StreamController<OrderStreamSignal> _signals;
  StreamSubscription<String>? _body;
  bool _cancelled = false;

  /// Evento do pedido; o `ping` e os demais nomes são ignorados.
  static const _orderEvent = 'order';

  /// Respostas que encerram o stream sem nova tentativa (`FINAL_STATUSES` do
  /// web).
  static const _refusedStatuses = {401, 403, 404};

  Stream<OrderStreamSignal> get signals => _signals.stream;

  Future<void> _connect() async {
    final ResponseBody? body;
    try {
      final response = await _dio.get<ResponseBody>(
        _path,
        cancelToken: _cancelToken,
        options: Options(
          responseType: ResponseType.stream,
          headers: {Headers.acceptHeader: 'text/event-stream'},
          // Sem limite: os 10 s do cliente derrubariam a conexão entre dois
          // `ping` (20 s).
          receiveTimeout: Duration.zero,
          // O corpo de erro não é lido; o dio o fecha.
          receiveDataWhenStatusError: false,
        ),
      );
      body = response.data;
    } on DioException catch (exception) {
      if (_refusedStatuses.contains(exception.response?.statusCode)) {
        _add(OrderStreamRefused(mapHttpFailure(exception)));
      }
      _close();
      return;
    }
    if (_cancelled) return;
    if (body == null) {
      _close();
      return;
    }

    _add(const OrderStreamOpened());
    final parser = EventStreamParser((event) {
      if (event.type == _orderEvent) _add(const OrderStreamNotice());
    });
    // O `utf8.decoder` em modo stream junta o caractere cortado entre dois
    // pedaços.
    _body = utf8.decoder
        .bind(body.stream)
        .listen(
          parser.push,
          onError: (Object _) => _close(),
          onDone: _close,
          cancelOnError: true,
        );
  }

  void _add(OrderStreamSignal signal) {
    if (!_cancelled && !_signals.isClosed) _signals.add(signal);
  }

  void _close() {
    if (!_signals.isClosed) _signals.close();
  }

  Future<void> _cancel() async {
    _cancelled = true;
    _cancelToken.cancel();
    await _body?.cancel();
  }
}
