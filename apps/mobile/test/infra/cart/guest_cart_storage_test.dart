import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/cart/guest_cart_storage.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';

import '../storage/support/fake_key_value_store.dart';

const key = 'jaja.guest-cart';

CartItem item(String productId, int quantity) =>
    CartItem(productId: productId, quantity: quantity);

void main() {
  group('GuestCartStorage', () {
    test('usa a chave do web', () {
      expect(GuestCartStorage.storageKey, key);
    });

    test('grava na chave jaja.guest-cart e lê de volta na ordem', () async {
      final store = FakeKeyValueStore();
      final storage = GuestCartStorage(store);

      await storage.write([item('b', 2), item('a', 1)]);

      expect(jsonDecode(store.values[key]!), [
        {'productId': 'b', 'quantity': 2},
        {'productId': 'a', 'quantity': 1},
      ]);
      expect(await GuestCartStorage(store).read(), [
        item('b', 2),
        item('a', 1),
      ]);
    });

    test('chave ausente é carrinho vazio', () async {
      expect(await GuestCartStorage(FakeKeyValueStore()).read(), isEmpty);
    });

    test('normaliza o conteúdo guardado irregular', () async {
      final store = FakeKeyValueStore(
        initialValues: {
          key:
              '[{"productId":" A ","quantity":60},{"productId":"a","quantity":60},'
              '{"productId":"b","quantity":0},{"quantity":2}]',
        },
      );

      expect(await GuestCartStorage(store).read(), [item('a', 99)]);
    });

    test('texto ilegível é carrinho vazio', () async {
      final store = FakeKeyValueStore(initialValues: {key: 'não é json'});

      expect(await GuestCartStorage(store).read(), isEmpty);
    });

    test('JSON que não é lista é carrinho vazio', () async {
      final store = FakeKeyValueStore(initialValues: {key: '{"a":1}'});

      expect(await GuestCartStorage(store).read(), isEmpty);
    });

    test('lista vazia apaga a chave', () async {
      final store = FakeKeyValueStore(
        initialValues: {key: '[{"productId":"a","quantity":1}]'},
      );
      final storage = GuestCartStorage(store);
      await storage.read();

      await storage.write(const []);

      expect(store.values.containsKey(key), isFalse);
    });

    test('mesmo conteúdo do último gravado não regrava', () async {
      final store = FakeKeyValueStore();
      final storage = GuestCartStorage(store);
      await storage.write([item('a', 1)]);
      store.values[key] = 'alterado por fora';

      await storage.write([item('a', 1)]);

      expect(store.values[key], 'alterado por fora');
    });

    test('mesmo conteúdo da leitura não regrava', () async {
      const stored = '[{"productId":"a","quantity":2}]';
      final store = FakeKeyValueStore(initialValues: {key: stored});
      final storage = GuestCartStorage(store);
      final items = await storage.read();
      store.values[key] = 'alterado por fora';

      await storage.write(items);

      expect(store.values[key], 'alterado por fora');
    });

    test('conteúdo diferente regrava', () async {
      final store = FakeKeyValueStore();
      final storage = GuestCartStorage(store);
      await storage.write([item('a', 1)]);

      await storage.write([item('a', 2)]);

      expect(jsonDecode(store.values[key]!), [
        {'productId': 'a', 'quantity': 2},
      ]);
    });

    test('failOnRead é carrinho vazio', () async {
      final store = FakeKeyValueStore(
        initialValues: {key: '[{"productId":"a","quantity":1}]'},
        failOnRead: true,
      );

      expect(await GuestCartStorage(store).read(), isEmpty);
    });

    test('failOnWrite não lança nem grava', () async {
      final store = FakeKeyValueStore(failOnWrite: true);

      await expectLater(
        GuestCartStorage(store).write([item('a', 1)]),
        completes,
      );
      expect(store.values, isEmpty);
    });
  });
}
