import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart' show WatchingStatefulWidget, watch;

import '../../../../core/result.dart';
import '../../../../modules/customer/errors/customer_errors.dart';
import '../../../../modules/customer/usecase/load_delivery_details_use_case.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/view_models/block_state.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/skeleton_box.dart';
import '../../../shared/widgets/state_error_banner.dart';
import '../view_models/delivery_details_view_model.dart';
import '../widgets/account_data_card.dart';
import '../widgets/address_fields.dart';
import '../widgets/customer_field_bindings.dart';
import '../widgets/personal_data_fields.dart';

/// Tela "Dados de entrega", na pilha da aba Conta (`my-account.page.tsx` do
/// web, sem mapa): o skeleton dos cartões enquanto o cadastro carrega, o
/// banner com "Tentar de novo" na falha ou o formulário com "Dados pessoais"
/// (nome e e-mail da conta só para leitura, CPF e telefone) e "Endereço de
/// entrega". O rodapé fixo tem "Salvar dados" (só com alteração) e
/// "Descartar alterações". A navegação sai por callback.
class DeliveryDetailsPage extends WatchingStatefulWidget {
  const DeliveryDetailsPage({
    super.key,
    required this.deliveryDetailsViewModelFactory,
    required this.onBack,
    this.onSaved,
  });

  static const String title = 'Dados de entrega';
  static const String errorTitle = 'Não foi possível carregar seus dados.';
  static const String newCustomerMessage =
      'Preencha uma vez e seus pedidos saem mais rápido.';
  static const String personalTitle = 'Dados pessoais';
  static const String addressTitle = 'Endereço de entrega';
  static const String saveLabel = 'Salvar dados';
  static const String savingLabel = 'Salvando…';
  static const String discardLabel = 'Descartar alterações';
  static const String savedMessage = 'Dados salvos';

  /// Cria o ViewModel; a rota passa o `registerFactory` da DI.
  final DeliveryDetailsViewModel Function() deliveryDetailsViewModelFactory;

  /// Volta à aba Conta.
  final VoidCallback onBack;

  /// Chamado depois de "Dados salvos"; a rota do checkout volta a ele. Na aba
  /// Conta não é passado, e a tela continua aberta.
  final VoidCallback? onSaved;

  @override
  State<DeliveryDetailsPage> createState() => _DeliveryDetailsPageState();
}

class _DeliveryDetailsPageState extends State<DeliveryDetailsPage> {
  late final DeliveryDetailsViewModel _viewModel;
  final Map<CustomerField, TextEditingController> _controllers = {
    for (final field in CustomerField.values) field: TextEditingController(),
  };
  int? _syncedRevision;

  @override
  void initState() {
    super.initState();
    _viewModel = widget.deliveryDetailsViewModelFactory();
    _viewModel.addListener(_syncControllers);
    _viewModel.load.execute();
  }

  @override
  void dispose() {
    _viewModel.removeListener(_syncControllers);
    _viewModel.dispose();
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  /// Reescreve os controllers quando o ViewModel troca os campos (carga,
  /// descarte, gravação); a digitação não muda o `formRevision`.
  void _syncControllers() {
    final revision = _viewModel.formRevision;
    if (revision == _syncedRevision) return;
    _syncedRevision = revision;
    for (final MapEntry(key: field, value: controller)
        in _controllers.entries) {
      controller.text = _viewModel.fields.valueOf(field);
    }
  }

  Future<void> _save() async {
    final messenger = ScaffoldMessenger.of(context);
    await _viewModel.save.execute();
    if (_viewModel.save.result is Ok) {
      messenger.showSnackBar(
        const SnackBar(content: Text(DeliveryDetailsPage.savedMessage)),
      );
      widget.onSaved?.call();
    } else if (_viewModel.formError case final message?) {
      messenger.showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    watch(_viewModel);
    final details = _viewModel.details;

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: widget.onBack),
        title: const Text(DeliveryDetailsPage.title),
      ),
      body: switch (details) {
        BlockLoading() => ListView(
          padding: const EdgeInsets.all(AppSpacing.s16),
          children: const [_FormSkeleton()],
        ),
        BlockFailed(:final failure) => ListView(
          padding: const EdgeInsets.all(AppSpacing.s16),
          children: [
            StateErrorBanner(
              title: DeliveryDetailsPage.errorTitle,
              failure: failure,
              onRetry: _viewModel.load.execute,
            ),
          ],
        ),
        BlockLoaded() => _form(context),
      },
      bottomNavigationBar: details is BlockLoaded<DeliveryDetails>
          ? _SaveBar(
              isDirty: _viewModel.isDirty,
              saving: _viewModel.save.running,
              onSave: _save,
              onDiscard: _viewModel.discard,
            )
          : null,
    );
  }

  Widget _form(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final user = _viewModel.user;
    final bindings = CustomerFieldBindings(
      controllerOf: (field) => _controllers[field]!,
      errorOf: _viewModel.errorOf,
      onChanged: _viewModel.update,
      enabled: !_viewModel.save.running,
    );

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.s16),
      children: [
        if (!_viewModel.hasCustomer) ...[
          Text(
            DeliveryDetailsPage.newCustomerMessage,
            style: textTheme.bodyMedium!.copyWith(color: tokens.inkSoft),
          ),
          const SizedBox(height: AppSpacing.s16),
        ],
        _FormSection(
          title: DeliveryDetailsPage.personalTitle,
          children: [
            AccountDataCard(name: user?.name ?? '', email: user?.email ?? ''),
            const SizedBox(height: AppSpacing.s16),
            PersonalDataFields(bindings: bindings),
          ],
        ),
        const SizedBox(height: AppSpacing.s16),
        _FormSection(
          title: DeliveryDetailsPage.addressTitle,
          children: [AddressFields(bindings: bindings)],
        ),
      ],
    );
  }
}

/// Cartão com título, no molde dos cartões do "Minha conta" do web.
class _FormSection extends StatelessWidget {
  const _FormSection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.card,
        border: Border.all(color: tokens.line),
        borderRadius: BorderRadius.circular(AppRadius.xl4),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              style: textTheme.titleLarge!.copyWith(color: tokens.ink),
            ),
            const SizedBox(height: AppSpacing.s16),
            ...children,
          ],
        ),
      ),
    );
  }
}

/// Rodapé fixo: "Salvar dados" ("Salvando…" durante o envio, indisponível sem
/// alteração) e, só com alteração, "Descartar alterações".
class _SaveBar extends StatelessWidget {
  const _SaveBar({
    required this.isDirty,
    required this.saving,
    required this.onSave,
    required this.onDiscard,
  });

  final bool isDirty;
  final bool saving;
  final VoidCallback onSave;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.card,
        border: Border(top: BorderSide(color: tokens.line)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppButton(
                label: saving
                    ? DeliveryDetailsPage.savingLabel
                    : DeliveryDetailsPage.saveLabel,
                onPressed: isDirty && !saving ? onSave : null,
                size: AppButtonSize.xl,
                expand: true,
              ),
              if (isDirty) ...[
                const SizedBox(height: AppSpacing.s8),
                AppButton(
                  label: DeliveryDetailsPage.discardLabel,
                  onPressed: saving ? null : onDiscard,
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.lg,
                  expand: true,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Os dois cartões estáticos no lugar do formulário, anunciados uma vez como
/// "Carregando".
class _FormSkeleton extends StatelessWidget {
  const _FormSkeleton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Carregando',
      excludeSemantics: true,
      child: const Column(
        children: [
          SkeletonBox(height: 280, radius: AppRadius.xl4),
          SizedBox(height: AppSpacing.s16),
          SkeletonBox(height: 520, radius: AppRadius.xl4),
        ],
      ),
    );
  }
}
