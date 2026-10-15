import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/ui/modules/catalog/view_models/block_state.dart';
import 'package:mobile/ui/modules/catalog/widgets/home_section.dart';
import 'package:mobile/ui/modules/catalog/widgets/section_heading.dart';
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';
import 'package:mobile/ui/shared/widgets/state_error_banner.dart';

import '../../../shared/support/themed.dart';

const _failure = NetworkFailure(
  message: 'Sem conexão com a internet.',
  code: GenericFailureCode.unspecified,
);

Widget _section({
  required BlockState<List<String>> state,
  VoidCallback? onRetry,
  VoidCallback? onSeeAll,
}) => themed(
  HomeSection<String>(
    title: 'Em destaque',
    state: state,
    errorTitle: 'Não foi possível carregar os destaques.',
    onRetry: onRetry ?? () {},
    onSeeAll: onSeeAll ?? () {},
    skeleton: const SkeletonBox(height: 40),
    builder: (items) => Column(children: [for (final i in items) Text(i)]),
  ),
);

void main() {
  testWidgets('carregando: título e skeleton, sem "Ver tudo →"', (
    tester,
  ) async {
    await tester.pumpWidget(_section(state: const BlockLoading()));

    expect(find.text('Em destaque'), findsOneWidget);
    expect(find.byType(SkeletonBox), findsOneWidget);
    expect(find.text('Ver tudo →'), findsNothing);
    expect(find.byType(StateErrorBanner), findsNothing);
  });

  testWidgets('falha: banner com o título próprio e "Tentar de novo"', (
    tester,
  ) async {
    var retries = 0;
    await tester.pumpWidget(
      _section(state: const BlockFailed(_failure), onRetry: () => retries++),
    );

    expect(find.text('Em destaque'), findsOneWidget);
    expect(
      find.text('Não foi possível carregar os destaques.'),
      findsOneWidget,
    );
    expect(find.text('Sem conexão com a internet.'), findsOneWidget);
    expect(find.byType(SkeletonBox), findsNothing);
    expect(find.text('Ver tudo →'), findsNothing);

    await tester.tap(find.text('Tentar de novo'));
    await tester.pump();
    expect(retries, 1);
  });

  testWidgets('carregada e vazia: nada', (tester) async {
    await tester.pumpWidget(_section(state: const BlockLoaded([])));

    expect(find.text('Em destaque'), findsNothing);
    expect(find.byType(SectionHeading), findsNothing);
    expect(find.byType(SkeletonBox), findsNothing);
    expect(find.byType(StateErrorBanner), findsNothing);
  });

  testWidgets('carregada: título, "Ver tudo →" e o conteúdo', (tester) async {
    var seeAll = 0;
    await tester.pumpWidget(
      _section(
        state: const BlockLoaded(['Caneta', 'Papel']),
        onSeeAll: () => seeAll++,
      ),
    );

    expect(find.text('Em destaque'), findsOneWidget);
    expect(find.text('Caneta'), findsOneWidget);
    expect(find.text('Papel'), findsOneWidget);
    expect(find.byType(SkeletonBox), findsNothing);

    await tester.tap(find.text('Ver tudo →'));
    expect(seeAll, 1);
  });

  testWidgets('carregada sem onSeeAll: sem "Ver tudo →"', (tester) async {
    await tester.pumpWidget(
      themed(
        HomeSection<String>(
          title: 'Categorias em destaque',
          state: const BlockLoaded(['Toners HP']),
          errorTitle: 'Não foi possível carregar as categorias.',
          onRetry: () {},
          skeleton: const SkeletonBox(height: 40),
          builder: (items) => Text(items.single),
        ),
      ),
    );

    expect(find.text('Categorias em destaque'), findsOneWidget);
    expect(find.text('Toners HP'), findsOneWidget);
    expect(find.text('Ver tudo →'), findsNothing);
  });
}
