import 'package:flutter/material.dart';

import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/state_error_banner.dart';
import '../../../shared/view_models/block_state.dart';
import 'section_heading.dart';

/// Seção da Início que depende de uma busca remota, no padrão de tela
/// remota: carregando, o cabeçalho sem ação e o [skeleton]; em falha, o
/// cabeçalho e o banner com [errorTitle] e "Tentar de novo"; carregada e
/// vazia, nada; carregada, o cabeçalho com "Ver tudo →" (se [onSeeAll]) e o
/// conteúdo de [builder].
class HomeSection<T> extends StatelessWidget {
  const HomeSection({
    super.key,
    required this.title,
    required this.state,
    required this.errorTitle,
    required this.onRetry,
    required this.skeleton,
    required this.builder,
    this.onSeeAll,
  });

  final String title;
  final BlockState<List<T>> state;
  final String errorTitle;

  /// "Tentar de novo": refaz só a busca desta seção.
  final VoidCallback onRetry;
  final VoidCallback? onSeeAll;
  final Widget skeleton;
  final Widget Function(List<T> items) builder;

  @override
  Widget build(BuildContext context) {
    return switch (state) {
      BlockLoading() => _section(SectionHeading(title: title), skeleton),
      BlockFailed(:final failure) => _section(
        SectionHeading(title: title),
        StateErrorBanner(title: errorTitle, failure: failure, onRetry: onRetry),
      ),
      BlockLoaded(:final value) when value.isEmpty => const SizedBox.shrink(),
      BlockLoaded(:final value) => _section(
        SectionHeading(title: title, onSeeAll: onSeeAll),
        builder(value),
      ),
    };
  }

  // `mb-3.5` do `SectionHeading` do web.
  Widget _section(Widget heading, Widget body) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      heading,
      const SizedBox(height: AppSpacing.s14),
      body,
    ],
  );
}
