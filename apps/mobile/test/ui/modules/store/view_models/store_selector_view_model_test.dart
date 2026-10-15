import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/store/model/store_entity.dart';
import 'package:mobile/ui/modules/store/view_models/store_selector_view_model.dart';

import '../../../../modules/store/support/fake_store_repository.dart';
import '../../../../modules/store/support/store_fixtures.dart';

const _networkFailure = NetworkFailure(
  message: 'Não foi possível falar com o servidor. Tente novamente.',
  code: HttpFailureCode.noConnection,
);

void main() {
  late FakeStoreRepository repository;
  late StoreSelectorViewModel viewModel;

  setUp(() {
    repository = FakeStoreRepository(stores: const [paulista, rioBranco]);
    viewModel = StoreSelectorViewModel(repository);
  });

  tearDown(() => viewModel.dispose());

  group('load', () {
    test('antes do load está carregando, sem lojas, loja nem falha', () {
      expect(viewModel.loading, isTrue);
      expect(viewModel.hasLoadedOnce, isFalse);
      expect(viewModel.stores, isEmpty);
      expect(viewModel.current, isNull);
      expect(viewModel.failure, isNull);
    });

    test('segue carregando enquanto a API não responde', () async {
      final gate = repository.hold();

      final loading = viewModel.load.execute();
      expect(viewModel.loading, isTrue);
      expect(viewModel.stores, isEmpty);

      gate.complete(const Ok([paulista, rioBranco]));
      await loading;

      expect(viewModel.loading, isFalse);
      expect(viewModel.stores, [paulista, rioBranco]);
    });

    test(
      'pede a lista sem refresh e guarda as lojas na ordem da API',
      () async {
        await viewModel.load.execute();

        expect(repository.fetchCalls, [false]);
        expect(viewModel.stores, [paulista, rioBranco]);
        expect(viewModel.hasLoadedOnce, isTrue);
        expect(viewModel.loading, isFalse);
        expect(viewModel.failure, isNull);
      },
    );

    test('a lista exposta não pode ser alterada pela tela', () async {
      await viewModel.load.execute();

      expect(() => viewModel.stores.add(paulista), throwsUnsupportedError);
    });

    test(
      'com lembrança loja-rio-branco a loja em vigor é Rio Branco',
      () async {
        repository.rememberedSlug = 'loja-rio-branco';

        await viewModel.load.execute();

        expect(viewModel.current, rioBranco);
      },
    );

    test('sem lembrança a loja em vigor é a primeira', () async {
      await viewModel.load.execute();

      expect(viewModel.current, paulista);
      expect(repository.rememberCalls, isEmpty);
    });

    test('lembrança desconhecida cai na primeira sem gravar nada', () async {
      repository.rememberedSlug = 'loja-centro';

      await viewModel.load.execute();

      expect(viewModel.current, paulista);
      expect(repository.rememberCalls, isEmpty);
      expect(repository.rememberedSlug, 'loja-centro');
    });
  });

  group('falha e recarga', () {
    test(
      'load com falha guarda a falha, sem lojas nem loja em vigor',
      () async {
        repository.enqueue(const Failure(_networkFailure));

        await viewModel.load.execute();

        expect(viewModel.failure, same(_networkFailure));
        expect(viewModel.stores, isEmpty);
        expect(viewModel.current, isNull);
        expect(viewModel.loading, isFalse);
        expect(viewModel.hasLoadedOnce, isTrue);
      },
    );

    test('reload pede refresh e limpa a falha quando a API responde', () async {
      repository.enqueue(const Failure(_networkFailure));
      await viewModel.load.execute();

      await viewModel.reload.execute();

      expect(repository.fetchCalls, [false, true]);
      expect(viewModel.failure, isNull);
      expect(viewModel.stores, [paulista, rioBranco]);
      expect(viewModel.current, paulista);
    });

    test('reload que falha de novo mantém a falha e a lista vazia', () async {
      repository.enqueue(const Failure(_networkFailure));
      await viewModel.load.execute();
      repository.enqueue(const Failure(_networkFailure));

      await viewModel.reload.execute();

      expect(viewModel.failure, same(_networkFailure));
      expect(viewModel.stores, isEmpty);
      expect(viewModel.loading, isFalse);
    });

    test('reload está carregando enquanto a API não responde', () async {
      await viewModel.load.execute();
      final gate = repository.hold();

      final reloading = viewModel.reload.execute();
      expect(viewModel.loading, isTrue);

      gate.complete(const Ok([paulista]));
      await reloading;

      expect(viewModel.loading, isFalse);
      expect(viewModel.stores, [paulista]);
    });

    test('lista vazia deixa a loja em vigor nula, sem falha', () async {
      repository.enqueue(const Ok(<Store>[]));

      await viewModel.load.execute();

      expect(viewModel.stores, isEmpty);
      expect(viewModel.current, isNull);
      expect(viewModel.failure, isNull);
      expect(viewModel.loading, isFalse);
    });
  });

  group('select', () {
    late List<Store?> notified;

    setUp(() async {
      await viewModel.load.execute();
      notified = [];
      viewModel.addListener(() => notified.add(viewModel.current));
    });

    test('troca a loja em vigor, avisa a tela e lembra o slug', () async {
      await viewModel.select.execute('loja-rio-branco');

      expect(viewModel.current, rioBranco);
      // Além do início e do fim do command, uma notificação com a loja nova.
      expect(notified, [paulista, rioBranco, rioBranco]);
      expect(repository.rememberCalls, ['loja-rio-branco']);
      expect(repository.rememberedSlug, 'loja-rio-branco');
    });

    test('o slug atual não grava nem avisa troca', () async {
      await viewModel.select.execute('loja-paulista');

      expect(viewModel.current, paulista);
      // Só o início e o fim do command, sem notificação de troca.
      expect(notified, [paulista, paulista]);
      expect(repository.rememberCalls, isEmpty);
    });

    test('slug fora da lista não troca, não grava nem avisa troca', () async {
      await viewModel.select.execute('loja-centro');

      expect(viewModel.current, paulista);
      expect(notified, [paulista, paulista]);
      expect(repository.rememberCalls, isEmpty);
      expect(repository.rememberedSlug, isNull);
    });

    test('a loja escolhida continua em vigor depois de um reload', () async {
      await viewModel.select.execute('loja-rio-branco');

      await viewModel.reload.execute();

      expect(viewModel.current, rioBranco);
    });
  });
}
