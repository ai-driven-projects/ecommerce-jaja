import 'dart:convert';

/// Evento de um stream `text/event-stream`: o nome (`event:`, `message` sem
/// ele) e o `data` já convertido de JSON.
final class ServerSentEvent {
  const ServerSentEvent(this.type, this.data);

  final String type;
  final Object? data;
}

/// Leitor incremental do formato SSE, cópia de `createEventStreamParser`
/// (`apps/frontend/src/shared/util/event-stream.util.ts`). Recebe o texto em
/// pedaços ([push]), em qualquer ponto de corte, e chama [onEvent] a cada
/// evento completo:
/// - linhas terminam em `\n`, `\r\n` ou `\r`;
/// - `event:` define o nome, e várias linhas `data:` são juntadas com `\n`;
/// - a linha em branco despacha o evento (sem `data`, nada é despachado);
/// - linhas começando com `:` são comentários; `id:`, `retry:` e campos
///   desconhecidos são ignorados;
/// - o `data` é convertido de JSON, e o que não for JSON válido é descartado.
final class EventStreamParser {
  EventStreamParser(this.onEvent);

  final void Function(ServerSentEvent event) onEvent;

  static const _defaultEvent = 'message';
  static final _lineBreak = RegExp(r'\r\n|\r|\n');

  String _buffer = '';
  String _eventName = '';
  List<String> _dataLines = [];

  /// Acrescenta um pedaço do texto e despacha os eventos que ele completa.
  void push(String chunk) {
    _buffer += chunk;
    var match = _lineBreak.firstMatch(_buffer);
    while (match != null) {
      // Um `\r` no fim do pedaço pode ser a metade de um `\r\n`: espera o
      // próximo.
      if (match[0] == '\r' && match.start == _buffer.length - 1) break;
      _processLine(_buffer.substring(0, match.start));
      _buffer = _buffer.substring(match.end);
      match = _lineBreak.firstMatch(_buffer);
    }
  }

  void _processLine(String line) {
    if (line.isEmpty) {
      _dispatch();
      return;
    }
    if (line.startsWith(':')) return;

    final colon = line.indexOf(':');
    final field = colon == -1 ? line : line.substring(0, colon);
    var value = colon == -1 ? '' : line.substring(colon + 1);
    if (value.startsWith(' ')) value = value.substring(1);

    if (field == 'event') {
      _eventName = value;
    } else if (field == 'data') {
      _dataLines.add(value);
    }
  }

  void _dispatch() {
    final type = _eventName.isEmpty ? _defaultEvent : _eventName;
    final lines = _dataLines;
    _eventName = '';
    _dataLines = [];
    if (lines.isEmpty) return;

    final Object? data;
    try {
      data = jsonDecode(lines.join('\n'));
    } on FormatException {
      return;
    }
    onEvent(ServerSentEvent(type, data));
  }
}
