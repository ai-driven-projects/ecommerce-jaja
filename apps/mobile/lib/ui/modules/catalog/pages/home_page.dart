import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/placeholder_body.dart';
import '../../store/view_models/store_selector_view_model.dart';
import '../../store/widgets/store_picker_sheet.dart';
import '../../store/widgets/store_selector.dart';

/// Aba Início: o seletor de loja no topo e, abaixo, o conteúdo provisório que
/// a etapa da home substitui.
class HomePage extends WatchingStatefulWidget {
  const HomePage({super.key, required this.storeSelectorViewModelFactory});

  /// Cria o ViewModel do seletor; a rota passa o `registerFactory` da DI.
  final StoreSelectorViewModel Function() storeSelectorViewModelFactory;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final StoreSelectorViewModel _storeSelector;

  @override
  void initState() {
    super.initState();
    _storeSelector = widget.storeSelectorViewModelFactory();
    _storeSelector.load.execute();
  }

  @override
  void dispose() {
    _storeSelector.dispose();
    super.dispose();
  }

  Future<void> _changeStore() async {
    final stores = _storeSelector.stores;
    final current = _storeSelector.current;
    if (stores.length < 2 || current == null) return;

    final slug = await showStorePickerSheet(
      context,
      stores: stores,
      currentSlug: current.slug,
    );
    if (slug == null) return;
    await _storeSelector.select.execute(slug);
  }

  @override
  Widget build(BuildContext context) {
    final loading = watchPropertyValue(
      (StoreSelectorViewModel vm) => vm.loading,
      target: _storeSelector,
    );
    final failure = watchPropertyValue(
      (StoreSelectorViewModel vm) => vm.failure,
      target: _storeSelector,
    );
    final stores = watchPropertyValue(
      (StoreSelectorViewModel vm) => vm.stores,
      target: _storeSelector,
    );
    final current = watchPropertyValue(
      (StoreSelectorViewModel vm) => vm.current,
      target: _storeSelector,
    );

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.s16),
              child: StoreSelector(
                loading: loading,
                failure: failure,
                stores: stores,
                current: current,
                onReload: _storeSelector.reload.execute,
                onChangeStore: _changeStore,
              ),
            ),
            const Expanded(child: PlaceholderBody(title: 'Início')),
          ],
        ),
      ),
    );
  }
}
