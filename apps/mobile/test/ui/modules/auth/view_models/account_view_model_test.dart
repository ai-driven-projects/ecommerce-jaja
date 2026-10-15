import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/ui/modules/auth/view_models/account_view_model.dart';

import '../../../../modules/auth/support/auth_fixtures.dart';
import '../../../../modules/auth/support/fake_auth_repository.dart';

void main() {
  late FakeAuthRepository repository;

  setUp(() => repository = FakeAuthRepository());

  tearDown(() => repository.dispose());

  test('user inicial vem do repositório', () {
    final anonymous = AccountViewModel(repository);
    final signedIn = AccountViewModel(FakeAuthRepository(currentUser: ana));
    addTearDown(anonymous.dispose);
    addTearDown(signedIn.dispose);

    expect(anonymous.user, isNull);
    expect(signedIn.user, ana);
  });

  test('muda quando userChanges emite e avisa os ouvintes', () async {
    final viewModel = AccountViewModel(repository);
    addTearDown(viewModel.dispose);
    var notifications = 0;
    viewModel.addListener(() => notifications++);

    repository.emit(admin);
    await pumpEventQueue();

    expect(viewModel.user, admin);
    expect(notifications, 1);

    repository.emit(null);
    await pumpEventQueue();

    expect(viewModel.user, isNull);
    expect(notifications, 2);
  });

  test('signOut chama o repositório e o usuário some', () async {
    repository.emit(ana);
    final viewModel = AccountViewModel(repository);
    addTearDown(viewModel.dispose);

    await viewModel.signOut.execute();
    await pumpEventQueue();

    expect(repository.signOutCalls, 1);
    expect(viewModel.signOut.result, isA<Ok<void>>());
    expect(viewModel.user, isNull);
  });

  test('dispose cancela a assinatura', () async {
    final viewModel = AccountViewModel(repository);

    viewModel.dispose();
    repository.emit(ana);
    await pumpEventQueue();

    expect(viewModel.user, isNull);
  });
}
