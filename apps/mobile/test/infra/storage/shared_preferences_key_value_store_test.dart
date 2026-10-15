import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/storage/shared_preferences_key_value_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('SharedPreferencesKeyValueStore', () {
    test('lê um valor já gravado', () async {
      SharedPreferences.setMockInitialValues({
        'jaja:vitrine:loja': 'loja-rio-branco',
      });

      final store = SharedPreferencesKeyValueStore();

      expect(await store.readString('jaja:vitrine:loja'), 'loja-rio-branco');
    });

    test('chave ausente devolve null', () async {
      SharedPreferences.setMockInitialValues({});

      final store = SharedPreferencesKeyValueStore();

      expect(await store.readString('jaja:vitrine:loja'), isNull);
    });

    test('grava e lê de volta', () async {
      SharedPreferences.setMockInitialValues({});

      final store = SharedPreferencesKeyValueStore();
      await store.writeString('jaja:vitrine:loja', 'loja-paulista');

      expect(await store.readString('jaja:vitrine:loja'), 'loja-paulista');
      expect(
        (await SharedPreferences.getInstance()).getString('jaja:vitrine:loja'),
        'loja-paulista',
      );
    });

    test('valor de outro tipo na chave é lido como null', () async {
      SharedPreferences.setMockInitialValues({'jaja:vitrine:loja': 42});

      final store = SharedPreferencesKeyValueStore();

      expect(await store.readString('jaja:vitrine:loja'), isNull);
    });
  });
}
