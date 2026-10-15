import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';

// O `CachedNetworkImage` resolve a foto pelo `ImageCache` do Flutter com a
// chave `CachedNetworkImageProvider(url)`; se a chave já está lá, o cache do
// aparelho (`DefaultCacheManager`, que abre banco e pasta por canais de
// plataforma que o `flutter_test` não tem) nunca é acionado. Os helpers abaixo
// semeiam o cache antes de a tela pedir a foto; a entrada sai no fim do teste.

/// Toda foto de [url] falha assim que é pedida, sem rede: o `ProductArt`
/// mostra a reserva.
void failImageLoad(String url) => _seed(url, _FailingImageStreamCompleter.new);

/// A foto de [url] nunca chega: o `ProductArt` fica no placeholder.
void holdImageLoad(String url) => _seed(url, _PendingImageStreamCompleter.new);

void _seed(String url, ImageStreamCompleter Function() completer) {
  final key = CachedNetworkImageProvider(url);
  final imageCache = PaintingBinding.instance.imageCache;
  imageCache.putIfAbsent(key, completer);
  addTearDown(() => imageCache.evict(key));
}

/// Entrega a falha ao primeiro ouvinte que trata erro (o `Image` do widget);
/// o ouvinte interno do `ImageCache` não trata erro e é pulado, senão a falha
/// iria parar em `FlutterError.reportError` e derrubaria o teste.
class _FailingImageStreamCompleter extends ImageStreamCompleter {
  bool _reported = false;

  @override
  void addListener(ImageStreamListener listener) {
    super.addListener(listener);
    if (_reported || listener.onError == null) return;
    _reported = true;
    reportError(
      exception: NetworkImageLoadException(
        statusCode: 404,
        uri: Uri.parse('https://cdn.jaja.test/sem-fotos'),
      ),
      silent: true,
    );
  }
}

/// Nunca entrega foto nem erro.
class _PendingImageStreamCompleter extends ImageStreamCompleter {}
