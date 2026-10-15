import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../../core/result.dart';
import '../../../../core/value_objects/person_name.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../view_models/register_view_model.dart';

/// Tela cheia "Criar conta" (`register-form.tsx` do web), no molde da
/// `LoginPage`: nome, e-mail, senha e confirmação validados no aparelho, o
/// erro do envio acima do botão e o link "Já tenho conta". No sucesso mostra
/// "Conta criada. Bem-vindo, `<primeiro nome>`"; a guarda do router leva ao
/// destino.
class RegisterPage extends WatchingStatefulWidget {
  const RegisterPage({
    super.key,
    required this.registerViewModelFactory,
    required this.onClose,
    required this.onOpenLogin,
  });

  static const String title = 'Criar conta';
  static const String nameLabel = 'Nome';
  static const String nameHint = 'Nome e sobrenome';
  static const String emailLabel = 'E-mail';
  static const String emailHint = 'voce@empresa.com';
  static const String passwordLabel = 'Senha';
  static const String confirmPasswordLabel = 'Confirmar senha';
  static const String passwordHint = '••••••••';
  static const String submitLabel = 'Criar conta';
  static const String submittingLabel = 'Criando conta…';
  static const String loginLink = 'Já tenho conta';

  static String welcomeMessage(String firstName) =>
      'Conta criada. Bem-vindo, $firstName';

  /// Cria o ViewModel; a rota passa o `registerFactory` da DI.
  final RegisterViewModel Function() registerViewModelFactory;

  /// Fecha a tela (volta à anterior ou à Início).
  final VoidCallback onClose;

  /// Troca para "Entrar", mantendo o destino.
  final VoidCallback onOpenLogin;

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  late final RegisterViewModel _viewModel;

  @override
  void initState() {
    super.initState();
    _viewModel = widget.registerViewModelFactory();
  }

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    // Capturado antes do `await`: no sucesso a guarda troca a rota e esta
    // página sai da árvore.
    final messenger = ScaffoldMessenger.of(context);
    await _viewModel.submit.execute();
    if (_viewModel.submit.result case Ok(:final value)) {
      messenger.showSnackBar(
        SnackBar(content: Text(RegisterPage.welcomeMessage(value.firstName))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final nameError = watchPropertyValue(
      (RegisterViewModel vm) => vm.nameError,
      target: _viewModel,
    );
    final emailError = watchPropertyValue(
      (RegisterViewModel vm) => vm.emailError,
      target: _viewModel,
    );
    final passwordError = watchPropertyValue(
      (RegisterViewModel vm) => vm.passwordError,
      target: _viewModel,
    );
    final confirmPasswordError = watchPropertyValue(
      (RegisterViewModel vm) => vm.confirmPasswordError,
      target: _viewModel,
    );
    final formError = watchPropertyValue(
      (RegisterViewModel vm) => vm.formError,
      target: _viewModel,
    );
    final submitting = watchPropertyValue(
      (RegisterViewModel vm) => vm.submit.running,
      target: _viewModel,
    );
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(leading: CloseButton(onPressed: widget.onClose)),
      body: AutofillGroup(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.s16),
          children: [
            Text(
              RegisterPage.title,
              style: textTheme.headlineSmall!.copyWith(color: tokens.ink),
            ),
            const SizedBox(height: AppSpacing.s24),
            AppTextField(
              label: RegisterPage.nameLabel,
              hintText: RegisterPage.nameHint,
              onChanged: _viewModel.updateName,
              errorText: nameError,
              maxLength: PersonName.maxLength,
              keyboardType: TextInputType.name,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.name],
            ),
            const SizedBox(height: AppSpacing.s16),
            AppTextField(
              label: RegisterPage.emailLabel,
              hintText: RegisterPage.emailHint,
              onChanged: _viewModel.updateEmail,
              errorText: emailError,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
            ),
            const SizedBox(height: AppSpacing.s16),
            AppTextField(
              label: RegisterPage.passwordLabel,
              hintText: RegisterPage.passwordHint,
              onChanged: _viewModel.updatePassword,
              errorText: passwordError,
              obscureText: true,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.newPassword],
            ),
            const SizedBox(height: AppSpacing.s16),
            AppTextField(
              label: RegisterPage.confirmPasswordLabel,
              hintText: RegisterPage.passwordHint,
              onChanged: _viewModel.updateConfirmPassword,
              errorText: confirmPasswordError,
              obscureText: true,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.newPassword],
            ),
            if (formError != null) ...[
              const SizedBox(height: AppSpacing.s16),
              Text(
                formError,
                style: textTheme.bodySmall!.copyWith(color: tokens.danger),
              ),
            ],
            const SizedBox(height: AppSpacing.s24),
            AppButton(
              label: submitting
                  ? RegisterPage.submittingLabel
                  : RegisterPage.submitLabel,
              onPressed: submitting ? null : _submit,
              size: AppButtonSize.xl,
              expand: true,
            ),
            const SizedBox(height: AppSpacing.s8),
            Center(
              child: TextButton(
                onPressed: widget.onOpenLogin,
                child: const Text(RegisterPage.loginLink),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
