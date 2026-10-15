import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../../core/result.dart';
import '../../../../modules/auth/model/auth_user_entity.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../view_models/account_view_model.dart';
import '../widgets/account_benefit.dart';

/// Aba Conta. Sem sessão, o convite para entrar ou criar conta (como a coluna
/// de vantagens da `/entrar` do web); com sessão, a saudação, o nome, o
/// e-mail (ou "Administrador") e "Sair". Troca de estado sozinha quando a
/// sessão começa ou termina; a navegação sai por callback.
class AccountPage extends WatchingStatefulWidget {
  const AccountPage({
    super.key,
    required this.accountViewModelFactory,
    required this.onOpenLogin,
    required this.onOpenRegister,
  });

  static const String inviteTitle = 'Entre ou crie sua conta.';
  static const String inviteMessage =
      'Uma conta para todo o escritório pedir o que falta e acompanhar a bike '
      'chegando.';
  static const List<String> benefits = [
    'Entrega de bike em minutos',
    'Endereço e andar salvos',
    'Histórico de pedidos do escritório',
  ];
  static const String loginLabel = 'Entrar';
  static const String registerLabel = 'Criar conta';
  static const String adminLabel = 'Administrador';
  static const String signOutLabel = 'Sair';
  static const String signedOutMessage = 'Até já já.';

  static String greeting(String firstName) => 'Olá, $firstName';

  /// Cria o ViewModel; a rota passa o `registerFactory` da DI.
  final AccountViewModel Function() accountViewModelFactory;

  /// Abre "Entrar" com destino nesta aba.
  final VoidCallback onOpenLogin;

  /// Abre "Criar conta" com destino nesta aba.
  final VoidCallback onOpenRegister;

  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  late final AccountViewModel _viewModel;

  @override
  void initState() {
    super.initState();
    _viewModel = widget.accountViewModelFactory();
  }

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  Future<void> _signOut() async {
    final messenger = ScaffoldMessenger.of(context);
    await _viewModel.signOut.execute();
    if (_viewModel.signOut.result is Ok) {
      messenger.showSnackBar(
        const SnackBar(content: Text(AccountPage.signedOutMessage)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = watchPropertyValue(
      (AccountViewModel vm) => vm.user,
      target: _viewModel,
    );
    final signingOut = watchPropertyValue(
      (AccountViewModel vm) => vm.signOut.running,
      target: _viewModel,
    );

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.s16),
          children: user == null
              ? _invite(context)
              : _profile(context, user, signingOut: signingOut),
        ),
      ),
    );
  }

  List<Widget> _invite(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    return [
      Text(
        AccountPage.inviteTitle,
        style: textTheme.displaySmall!.copyWith(color: tokens.ink),
      ),
      const SizedBox(height: AppSpacing.s12),
      Text(
        AccountPage.inviteMessage,
        style: textTheme.bodyMedium!.copyWith(color: tokens.mutedInk),
      ),
      const SizedBox(height: AppSpacing.s24),
      for (final benefit in AccountPage.benefits) ...[
        AccountBenefit(label: benefit),
        const SizedBox(height: AppSpacing.s12),
      ],
      const SizedBox(height: AppSpacing.s12),
      AppButton(
        label: AccountPage.loginLabel,
        onPressed: widget.onOpenLogin,
        size: AppButtonSize.xl,
        expand: true,
      ),
      const SizedBox(height: AppSpacing.s12),
      AppButton(
        label: AccountPage.registerLabel,
        onPressed: widget.onOpenRegister,
        variant: AppButtonVariant.secondary,
        size: AppButtonSize.xl,
        expand: true,
      ),
    ];
  }

  List<Widget> _profile(
    BuildContext context,
    AuthUser user, {
    required bool signingOut,
  }) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    return [
      Text(
        AccountPage.greeting(user.firstName),
        style: textTheme.headlineSmall!.copyWith(color: tokens.ink),
      ),
      const SizedBox(height: AppSpacing.s16),
      Text(
        user.name,
        style: textTheme.titleMedium!.copyWith(color: tokens.ink),
      ),
      const SizedBox(height: AppSpacing.s4),
      Text(
        user.isAdmin ? AccountPage.adminLabel : user.email,
        style: textTheme.bodyMedium!.copyWith(color: tokens.mutedInk),
      ),
      const SizedBox(height: AppSpacing.s24),
      AppButton(
        label: AccountPage.signOutLabel,
        onPressed: signingOut ? null : _signOut,
        variant: AppButtonVariant.outline,
        size: AppButtonSize.xl,
        expand: true,
      ),
    ];
  }
}
