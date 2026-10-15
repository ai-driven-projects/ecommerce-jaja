import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/http/event_stream_parser.dart';

void main() {
  late List<ServerSentEvent> events;
  late EventStreamParser parser;

  setUp(() {
    events = [];
    parser = EventStreamParser(events.add);
  });

  List<List<Object?>> received() => [
    for (final event in events) [event.type, event.data],
  ];

  const orderEvent =
      'event: order\n'
      'data: {"orderId":"o-1","eventType":"PICKING"}\n'
      '\n';

  group('campos', () {
    test('evento com event: e data: JSON', () {
      parser.push(orderEvent);

      expect(received(), [
        [
          'order',
          {'orderId': 'o-1', 'eventType': 'PICKING'},
        ],
      ]);
    });

    test('sem event: o nome é message', () {
      parser.push('data: {"ok":true}\n\n');

      expect(received(), [
        [
          'message',
          {'ok': true},
        ],
      ]);
    });

    test('várias data: são juntadas com \\n', () {
      parser.push('event: order\ndata: {"a":\ndata: 1}\n\n');

      expect(received(), [
        [
          'order',
          {'a': 1},
        ],
      ]);
    });

    test('remove só um espaço depois dos dois-pontos', () {
      parser.push('event:order\ndata:  "x"\n\n');

      expect(received(), [
        ['order', 'x'],
      ]);
    });

    test('comentário, id:, retry: e campo desconhecido são ignorados', () {
      parser.push(
        ': sinal de vida\n'
        'id: 42\n'
        'retry: 5000\n'
        'outro: valor\n'
        'event: order\n'
        'data: {"n":1}\n'
        '\n',
      );

      expect(received(), [
        [
          'order',
          {'n': 1},
        ],
      ]);
    });

    test('evento sem data não é despachado e não vaza para o próximo', () {
      parser.push('event: ping\n\ndata: {"n":2}\n\n');

      expect(received(), [
        [
          'message',
          {'n': 2},
        ],
      ]);
    });

    test('data que não é JSON é descartado', () {
      parser.push('event: order\ndata: não é json\n\n$orderEvent');

      expect(received().map((event) => event.first), ['order']);
      expect(events, hasLength(1));
    });

    test('linha em branco sem evento pendente não despacha nada', () {
      parser.push('\n\n\n');

      expect(events, isEmpty);
    });
  });

  group('fins de linha e cortes', () {
    test('\\r\\n como fim de linha', () {
      parser.push('event: order\r\ndata: {"n":1}\r\n\r\n');

      expect(received(), [
        [
          'order',
          {'n': 1},
        ],
      ]);
    });

    test('\\r como fim de linha', () {
      parser.push('event: order\rdata: {"n":1}\r\r: fim\r');

      expect(received(), [
        [
          'order',
          {'n': 1},
        ],
      ]);
    });

    test('evento cortado em qualquer ponto entre dois push', () {
      for (var cut = 0; cut <= orderEvent.length; cut++) {
        final cutEvents = <ServerSentEvent>[];
        EventStreamParser(cutEvents.add)
          ..push(orderEvent.substring(0, cut))
          ..push(orderEvent.substring(cut));

        expect(cutEvents, hasLength(1), reason: 'corte em $cut');
        expect(cutEvents.single.type, 'order', reason: 'corte em $cut');
        expect(cutEvents.single.data, {
          'orderId': 'o-1',
          'eventType': 'PICKING',
        }, reason: 'corte em $cut');
      }
    });

    test('nada sai antes da linha em branco chegar', () {
      parser.push('event: order\ndata: {"n":1}\n');

      expect(events, isEmpty);

      parser.push('\n');

      expect(events, hasLength(1));
    });

    test('\\r no fim de um pedaço seguido de \\n no próximo despacha uma vez '
        'só', () {
      parser
        ..push('event: order\r\ndata: {"n":1}\r\n\r')
        ..push('\n');

      expect(received(), [
        [
          'order',
          {'n': 1},
        ],
      ]);

      parser.push('data: {"n":2}\r\n\r\n');

      expect(received(), [
        [
          'order',
          {'n': 1},
        ],
        [
          'message',
          {'n': 2},
        ],
      ]);
    });
  });
}
