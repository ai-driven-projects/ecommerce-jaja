import 'package:flutter/material.dart';

import '../../../../modules/order/model/order_live_status.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Indicador do acompanhamento ao vivo, do `LiveIndicator` do web com
/// `hideWhenOff`: ponto verde com "Ao vivo" em [OrderLiveStatus.live], ponto
/// neutro com "Reconectando…" enquanto o stream abre ou espera nova
/// tentativa, e nada sem stream ([OrderLiveStatus.off]) ou com ele encerrado
/// ([OrderLiveStatus.closed]). Sem pulso.
class OrderLiveIndicator extends StatelessWidget {
  const OrderLiveIndicator({super.key, required this.status});

  static const String liveLabel = 'Ao vivo';
  static const String reconnectingLabel = 'Reconectando…';

  /// Lado do ponto (`size-2` do web).
  static const double dotSize = 8;

  final OrderLiveStatus status;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final (String label, Color dot, Color text)? look = switch (status) {
      OrderLiveStatus.live => (liveLabel, tokens.success, tokens.success),
      OrderLiveStatus.connecting || OrderLiveStatus.reconnecting => (
        reconnectingLabel,
        tokens.placeholder,
        tokens.mutedInk,
      ),
      OrderLiveStatus.off || OrderLiveStatus.closed => null,
    };
    if (look == null) return const SizedBox.shrink();
    final (label, dot, text) = look;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ExcludeSemantics(
          child: Container(
            width: dotSize,
            height: dotSize,
            decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
          ),
        ),
        // `gap-1.5` do web.
        const SizedBox(width: 6),
        Text(
          label,
          style: Theme.of(context).textTheme.labelMedium!.copyWith(color: text),
        ),
      ],
    );
  }
}
