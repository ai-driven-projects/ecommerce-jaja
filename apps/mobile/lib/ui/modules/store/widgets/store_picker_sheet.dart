import 'package:flutter/material.dart';

import '../../../../modules/store/model/store_entity.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Abre o painel "Comprar na loja" e devolve o slug da loja tocada, ou `null`
/// se a pessoa fechou o painel sem escolher.
Future<String?> showStorePickerSheet(
  BuildContext context, {
  required List<Store> stores,
  required String currentSlug,
}) {
  return showModalBottomSheet<String>(
    context: context,
    builder: (_) => StorePickerSheet(stores: stores, currentSlug: currentSlug),
  );
}

/// Conteúdo do painel: o título e uma linha por loja ativa, na ordem da API,
/// com a atual em laranja e marcada. Tocar numa linha fecha o painel com o
/// slug dela.
class StorePickerSheet extends StatelessWidget {
  const StorePickerSheet({
    super.key,
    required this.stores,
    required this.currentSlug,
  });

  static const String title = 'Comprar na loja';

  final List<Store> stores;
  final String currentSlug;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.s16,
              AppSpacing.s4,
              AppSpacing.s16,
              AppSpacing.s8,
            ),
            child: Text(
              title,
              style: textTheme.titleMedium!.copyWith(color: tokens.ink),
            ),
          ),
          for (final store in stores)
            _StoreRow(
              store: store,
              current: store.slug == currentSlug,
              onTap: () => Navigator.of(context).pop(store.slug),
            ),
          const SizedBox(height: AppSpacing.s8),
        ],
      ),
    );
  }
}

class _StoreRow extends StatelessWidget {
  const _StoreRow({
    required this.store,
    required this.current,
    required this.onTap,
  });

  final Store store;
  final bool current;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final place = store.place;

    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
      title: Text(
        store.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: textTheme.labelLarge!.copyWith(
          color: current ? tokens.brand : tokens.ink,
        ),
      ),
      subtitle: place == null
          ? null
          : Text(
              place.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: textTheme.bodySmall!.copyWith(color: tokens.mutedInk),
            ),
      trailing: current ? Icon(Icons.check, color: tokens.brand) : null,
    );
  }
}
