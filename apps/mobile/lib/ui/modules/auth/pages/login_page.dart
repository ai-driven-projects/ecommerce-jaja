import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../../core/result.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../view_models/login_view_model.dart';

/// Tela cheia "Entrar" (`login-form.tsx` do web): e-mail e senha validados no
/// aparelho, o erro do envio acima do botão e o link para "Criar conta". No
/// sucesso mostra "Bem-vindo, `<primeiro nome>`"; quem leva ao destino é a
/// guarda do router, que reage à sessão nova.
class LoginPage extends WatchingStatefulWidget {
  const LoginPage({
    super.key,
    required this.loginViewModelFactory,
    required this.onClose,
    required this.onOpenRegister,
  });

  static const String title = 'Entrar';
  static const String emailLabel = 'E-mail';
  static const String emailHint = 'voce@empresa.com';
  static const String passwordLabel = 'Senha';
  static const String passwordHint = '••••••••';
  static const String submitLabel = 'Entrar';
  static const String submittingLabel = 'Entrando…';
  static const String registerLink = 'Criar conta';

  static String welcomeMessage(String firstName) => 'Bem-vindo, $firstName';

  /// Cria o ViewModel; a rota passa o `registerFactory` da DI.
  final LoginViewModel Function() loginViewModelFactory;

  /// Fecha a tela (volta à anterior ou à Início).
  final VoidCallback onClose;

  /// Troca para "Criar conta", mantendo o destino.
  final VoidCallback onOpenRegister;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  late final LoginViewModel _viewModel;

  @override
  void initState() {
    super.initState();
    _viewModel = widget.loginViewModelFactory();
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
        SnackBar(content: Text(LoginPage.welcomeMessage(value.firstName))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final emailError = watchPropertyValue(
      (LoginViewModel vm) => vm.emailError,
      target: _viewModel,
    );
    final passwordError = watchPropertyValue(
      (LoginViewModel vm) => vm.passwordError,
      target: _viewModel,
    );
    final formError = watchPropertyValue(
      (LoginViewModel vm) => vm.formError,
      target: _viewModel,
    );
    final submitting = watchPropertyValue(
      (LoginViewModel vm) => vm.submit.running,
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
              LoginPage.title,
              style: textTheme.headlineSmall!.copyWith(color: tokens.ink),
            ),
            const SizedBox(height: AppSpacing.s24),
            AppTextField(
              label: LoginPage.emailLabel,
              hintText: LoginPage.emailHint,
              onChanged: _viewModel.updateEmail,
              errorText: emailError,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
            ),
            const SizedBox(height: AppSpacing.s16),
            AppTextField(
              label: LoginPage.passwordLabel,
              hintText: LoginPage.passwordHint,
              onChanged: _viewModel.updatePassword,
              errorText: passwordError,
              obscureText: true,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.password],
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
                  ? LoginPage.submittingLabel
                  : LoginPage.submitLabel,
              onPressed: submitting ? null : _submit,
              size: AppButtonSize.xl,
              expand: true,
            ),
            const SizedBox(height: AppSpacing.s8),
            Center(
              child: TextButton(
                onPressed: widget.onOpenRegister,
                child: const Text(LoginPage.registerLink),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
