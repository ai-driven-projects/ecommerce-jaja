import '../errors/app_failure.dart';
import '../result.dart';

enum AppEnvironment { dev, prod }

const _devApiUrl = 'http://localhost:4000';

const _definedApiUrl = String.fromEnvironment('API_URL');

/// Resolve o endereço base da API a partir de `--dart-define=API_URL=...`.
/// [definedApiUrl] é parâmetro só para os testes não dependerem do define.
Result<Uri> resolveApiBaseUrl(
  AppEnvironment environment, {
  String definedApiUrl = _definedApiUrl,
}) {
  final raw = definedApiUrl.trim();
  if (raw.isEmpty) {
    return switch (environment) {
      AppEnvironment.dev => Ok(Uri.parse(_devApiUrl)),
      AppEnvironment.prod => const Failure(
        ConfigurationFailure(
          message: 'Endereço da API não configurado.',
          code: ConfigurationCode.missingApiUrl,
        ),
      ),
    };
  }

  final uri = Uri.tryParse(raw.replaceFirst(RegExp(r'/+$'), ''));
  final isHttp = uri != null && (uri.scheme == 'http' || uri.scheme == 'https');
  if (!isHttp || uri.host.isEmpty) {
    return const Failure(
      ConfigurationFailure(
        message: 'Endereço da API inválido.',
        code: ConfigurationCode.invalidApiUrl,
      ),
    );
  }
  return Ok(uri);
}
