import 'package:mobile/infra/auth/session_storage.dart';

/// [SessionStorage] em memória para os testes. Começa com [value] e conta as
/// gravações ([writes]) e limpezas ([clears]).
class FakeSessionStorage implements SessionStorage {
  FakeSessionStorage([this.value]);

  String? value;
  final List<String> writes = [];
  int clears = 0;

  @override
  Future<String?> read() async => value;

  @override
  Future<void> write(String value) async {
    writes.add(value);
    this.value = value;
  }

  @override
  Future<void> clear() async {
    clears++;
    value = null;
  }
}
