import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/command.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';

typedef _Snapshot = ({bool running, Object? result});

void main() {
  group('Command0<T>', () {
    test(
      'avisa duas vezes: em execução sem resultado, depois com o resultado',
      () async {
        final snapshots = <_Snapshot>[];
        late final Command0<int> command;
        command = Command0<int>(
          () async => const Ok(1),
          onStateChange: () =>
              snapshots.add((running: command.running, result: command.result)),
        );

        await command.execute();

        expect(snapshots, hasLength(2));
        expect(snapshots[0].running, isTrue);
        expect(snapshots[0].result, isNull);
        expect(snapshots[1].running, isFalse);
        expect(snapshots[1].result, isA<Ok<int>>());
        expect((command.result as Ok<int>).value, 1);
      },
    );

    test('limpa o resultado anterior ao começar', () async {
      final gate = Completer<Result<int>>();
      var calls = 0;
      final command = Command0<int>(
        () => ++calls == 1 ? Future.value(const Ok(1)) : gate.future,
        onStateChange: () {},
      );

      await command.execute();
      expect(command.result, isA<Ok<int>>());

      final second = command.execute();
      expect(command.running, isTrue);
      expect(command.result, isNull);

      gate.complete(const Ok(2));
      await second;
      expect((command.result as Ok<int>).value, 2);
    });

    test('execução pedida enquanto outra roda é ignorada', () async {
      final gate = Completer<Result<int>>();
      var calls = 0;
      final command = Command0<int>(() {
        calls++;
        return gate.future;
      }, onStateChange: () {});

      final first = command.execute();
      final second = command.execute();
      gate.complete(const Ok(1));
      await Future.wait([first, second]);

      expect(calls, 1);
    });

    test('exceção vira falha inesperada com mensagem fixa', () async {
      final command = Command0<int>(
        () async => throw StateError('boom'),
        onStateChange: () {},
      );

      await command.execute();

      expect(command.running, isFalse);
      final failure = (command.result as Failure<int>).failure;
      expect(failure, isA<UnexpectedFailure>());
      expect(failure.message, 'Algo deu errado. Tente novamente.');
    });

    test('falha devolvida pela ação é guardada como veio', () async {
      const failure = NotFoundFailure(
        message: 'Produto não encontrado.',
        code: GenericFailureCode.unspecified,
      );
      final command = Command0<int>(
        () async => const Failure(failure),
        onStateChange: () {},
      );

      await command.execute();

      expect((command.result as Failure<int>).failure, same(failure));
    });
  });

  group('Command1<T, A>', () {
    test('repassa à ação o argumento de cada chamada', () async {
      final command = Command1<String, int>(
        (arg) async => Ok('valor:$arg'),
        onStateChange: () {},
      );

      await command.execute(1);
      expect((command.result as Ok<String>).value, 'valor:1');

      await command.execute(2);
      expect((command.result as Ok<String>).value, 'valor:2');
    });

    test(
      'avisa duas vezes: em execução sem resultado, depois com o resultado',
      () async {
        final snapshots = <_Snapshot>[];
        late final Command1<int, int> command;
        command = Command1<int, int>(
          (arg) async => Ok(arg),
          onStateChange: () =>
              snapshots.add((running: command.running, result: command.result)),
        );

        await command.execute(7);

        expect(snapshots, hasLength(2));
        expect(snapshots[0].running, isTrue);
        expect(snapshots[0].result, isNull);
        expect(snapshots[1].running, isFalse);
        expect((command.result as Ok<int>).value, 7);
      },
    );

    test('execução pedida enquanto outra roda é ignorada', () async {
      final gate = Completer<Result<int>>();
      final received = <int>[];
      final command = Command1<int, int>((arg) {
        received.add(arg);
        return gate.future;
      }, onStateChange: () {});

      final first = command.execute(1);
      final second = command.execute(2);
      gate.complete(const Ok(1));
      await Future.wait([first, second]);

      expect(received, [1]);
      expect((command.result as Ok<int>).value, 1);
    });

    test('exceção síncrona vira falha inesperada com mensagem fixa', () async {
      final command = Command1<int, int>(
        (arg) => throw StateError('boom'),
        onStateChange: () {},
      );

      await command.execute(1);

      expect(command.running, isFalse);
      final failure = (command.result as Failure<int>).failure;
      expect(failure, isA<UnexpectedFailure>());
      expect(failure.message, 'Algo deu errado. Tente novamente.');
    });
  });
}
