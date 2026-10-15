import 'package:flutter/material.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../modules/store/model/store_entity.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/skeleton_box.dart';
import '../../../shared/widgets/state_error_banner.dart';
import 'store_pill.dart';

/// Bloco do seletor de loja no padrão de tela remota: skeleton enquanto
/// carrega, banner de erro com "Tentar de novo", vazio com "Atualizar" e, com
/// lojas, a pílula da loja em vigor. Só recebe estado e callbacks; quem
/// observa o ViewModel é a página.
class StoreSelector extends StatelessWidget {
  const StoreSelector({
    super.key,
    required this.loading,
    required this.failure,
    required this.stores,
    required this.current,
    required this.onReload,
    required this.onChangeStore,
  });

  static const String errorTitle = 'Não foi possível carregar as lojas.';
  static const String emptyTitle = 'Nenhuma loja disponível';
  static const String emptyMessage = 'No momento nenhuma loja está atendendo.';
  static const String emptyAction = 'Atualizar';

  // Largura só do skeleton; a pílula tem a largura do conteúdo.
  static const double _skeletonWidth = 220;

  final bool loading;
  final AppFailure? failure;
  final List<Store> stores;
  final Store? current;

  /// "Tentar de novo" e "Atualizar": busca a lista de novo, sem reaproveitar.
  final VoidCallback onReload;

  /// Toque na pílula; só é ligado com duas ou mais lojas.
  final VoidCallback onChangeStore;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Align(
        alignment: Alignment.centerLeft,
        child: SkeletonBox(
          width: _skeletonWidth,
          height: StorePill.height,
          radius: AppRadius.pill,
        ),
      );
    }

    final failure = this.failure;
    if (failure != null) {
      return StateErrorBanner(
        title: errorTitle,
        failure: failure,
        onRetry: onReload,
      );
    }

    final current = this.current;
    if (current == null) {
      return EmptyState(
        emoji: '🏪',
        title: emptyTitle,
        message: emptyMessage,
        actionLabel: emptyAction,
        onAction: onReload,
      );
    }

    return Align(
      alignment: Alignment.centerLeft,
      child: StorePill(
        store: current,
        onTap: stores.length < 2 ? null : onChangeStore,
      ),
    );
  }
}
