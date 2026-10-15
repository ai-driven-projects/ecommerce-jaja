import 'package:flutter/material.dart';

import '../../../../modules/customer/model/customer_entity.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/view_models/block_state.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/skeleton_box.dart';
import '../../../shared/widgets/state_error_banner.dart';
import '../../customer/view_models/customer_masks.dart';
import '../../customer/view_models/delivery_address_line.dart';

/// Conteúdo do passo "Endereço de entrega": o skeleton enquanto o cadastro
/// carrega, o banner com "Tentar de novo" na falha, o convite para preencher
/// sem cadastro ou o resumo de `customer-delivery-summary.component.tsx`
/// (endereço em uma linha, telefone mascarado e "Alterar"). Sem aviso de
/// cobertura nem mapa.
class DeliveryStep extends StatelessWidget {
  const DeliveryStep({
    super.key,
    required this.customer,
    required this.onRetry,
    required this.onOpenDeliveryDetails,
  });

  static const String errorTitle = 'Não foi possível carregar seus dados.';
  static const String newCustomerMessage =
      'Precisamos destes dados uma vez só: ficam salvos para os próximos '
      'pedidos.';
  static const String fillAction = 'Preencher dados de entrega';
  static const String editAction = 'Alterar';

  /// Altura do skeleton, a do resumo com duas linhas.
  static const double skeletonHeight = 88;

  final BlockState<Customer?> customer;

  /// O "Tentar de novo" do banner.
  final VoidCallback onRetry;

  /// Abre a tela "Dados de entrega" ("Preencher" e "Alterar").
  final VoidCallback onOpenDeliveryDetails;

  @override
  Widget build(BuildContext context) {
    return switch (customer) {
      BlockLoading() => Semantics(
        container: true,
        label: 'Carregando',
        excludeSemantics: true,
        child: const SkeletonBox(height: skeletonHeight),
      ),
      BlockFailed(:final failure) => StateErrorBanner(
        title: errorTitle,
        failure: failure,
        onRetry: onRetry,
      ),
      BlockLoaded(value: null) => _invite(context),
      BlockLoaded(value: final Customer customer) => _summary(
        context,
        customer,
      ),
    };
  }

  Widget _invite(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          newCustomerMessage,
          style: textTheme.bodyMedium!.copyWith(color: tokens.inkSoft),
        ),
        const SizedBox(height: AppSpacing.s12),
        AppButton(
          label: fillAction,
          icon: Icons.location_on_outlined,
          variant: AppButtonVariant.outline,
          onPressed: onOpenDeliveryDetails,
        ),
      ],
    );
  }

  Widget _summary(BuildContext context, Customer customer) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s18,
          vertical: AppSpacing.s16,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _infoRow(
              icon: Icons.location_on_outlined,
              color: tokens.mutedInk,
              child: Text(
                formatDeliveryAddress(customer.address),
                style: textTheme.titleSmall!.copyWith(color: tokens.ink),
              ),
            ),
            const SizedBox(height: AppSpacing.s8),
            _infoRow(
              icon: Icons.phone_outlined,
              color: tokens.mutedInk,
              child: Text(
                formatPhoneInput(customer.phone),
                style: textTheme.bodyMedium!.copyWith(
                  color: tokens.inkSoft,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.s12),
            AppButton(
              label: editAction,
              variant: AppButtonVariant.outline,
              size: AppButtonSize.sm,
              onPressed: onOpenDeliveryDetails,
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow({
    required IconData icon,
    required Color color,
    required Widget child,
  }) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Icon(icon, size: 16, color: color),
      ),
      const SizedBox(width: AppSpacing.s10),
      Expanded(child: child),
    ],
  );
}
