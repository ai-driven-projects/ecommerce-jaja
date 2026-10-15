import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// `HttpClientAdapter` à mão para os testes de `lib/infra/http`: grava as
/// [requests] recebidas e responde, na ordem, o que foi enfileirado com
/// [enqueueResponse] ou [enqueueError]. Nenhuma requisição sai para a rede.
class FakeHttpClientAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = [];
  final List<_Reply> _replies = [];

  /// Enfileira uma resposta. [body] `Map`/`List` vira JSON (com
  /// `content-type: application/json` se [headers] não disser outro),
  /// `String` vai como está e `null` vira corpo vazio.
  void enqueueResponse({
    int statusCode = 200,
    Object? body,
    Map<String, List<String>> headers = const {},
  }) {
    _replies.add(_ResponseReply(statusCode, body, headers));
  }

  /// Enfileira um `DioException` do [type] pedido, lançado pelo adapter.
  void enqueueError(DioExceptionType type) {
    _replies.add(_ErrorReply(type));
  }

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (_replies.isEmpty) {
      throw StateError('Nenhuma resposta enfileirada para ${options.uri}.');
    }
    return switch (_replies.removeAt(0)) {
      _ResponseReply(:final statusCode, :final body, :final headers) =>
        _responseBody(statusCode, body, headers),
      _ErrorReply(:final type) => throw DioException(
        requestOptions: options,
        type: type,
      ),
    };
  }

  ResponseBody _responseBody(
    int statusCode,
    Object? body,
    Map<String, List<String>> headers,
  ) {
    final isJson = body is Map || body is List;
    final text = switch (body) {
      null => '',
      String() => body,
      _ => jsonEncode(body),
    };
    return ResponseBody.fromString(
      text,
      statusCode,
      headers: {
        if (isJson) Headers.contentTypeHeader: [Headers.jsonContentType],
        ...headers,
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

sealed class _Reply {}

final class _ResponseReply extends _Reply {
  _ResponseReply(this.statusCode, this.body, this.headers);

  final int statusCode;
  final Object? body;
  final Map<String, List<String>> headers;
}

final class _ErrorReply extends _Reply {
  _ErrorReply(this.type);

  final DioExceptionType type;
}
