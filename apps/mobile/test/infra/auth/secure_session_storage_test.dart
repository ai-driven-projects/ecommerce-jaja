import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/auth/secure_session_storage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('SecureSessionStorage', () {
    test('grava e lê de volta na chave jaja:sessao', () async {
      FlutterSecureStorage.setMockInitialValues({});
      final storage = SecureSessionStorage();

      await storage.write('{"token":"abc"}');

      expect(await storage.read(), '{"token":"abc"}');
      expect(
        await const FlutterSecureStorage().read(key: 'jaja:sessao'),
        '{"token":"abc"}',
      );
    });

    test('lê um valor já guardado', () async {
      FlutterSecureStorage.setMockInitialValues({'jaja:sessao': 'guardado'});

      expect(await SecureSessionStorage().read(), 'guardado');
    });

    test('chave ausente devolve null', () async {
      FlutterSecureStorage.setMockInitialValues({'outra': 'valor'});

      expect(await SecureSessionStorage().read(), isNull);
    });

    test('clear apaga a sessão e mantém as outras chaves', () async {
      FlutterSecureStorage.setMockInitialValues({
        'jaja:sessao': 'guardado',
        'outra': 'valor',
      });
      final storage = SecureSessionStorage();

      await storage.clear();

      expect(await storage.read(), isNull);
      expect(await const FlutterSecureStorage().read(key: 'outra'), 'valor');
    });
  });
}
