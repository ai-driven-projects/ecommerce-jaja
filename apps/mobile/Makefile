# Endereço da API em tempo de compilação. Sobrescreva na linha de comando:
# `make run-dev API_URL=http://10.0.2.2:4000`. Em produção é obrigatório.
API_URL ?= http://localhost:4000

.PHONY: tunnel run-dev run-dev-tunnel run-prod codegen analyze test check

# Túnel do backend local: no emulador Android, localhost:4000 passa a alcançar
# a porta 4000 da máquina. Cai quando o emulador reinicia; o run-dev-tunnel o
# refaz. O `-` evita abortar se o aparelho ainda não subiu.
tunnel:
	-adb reverse tcp:4000 tcp:4000

run-dev:
	flutter run -t lib/main_dev.dart --dart-define=API_URL=$(API_URL)

run-dev-tunnel: tunnel run-dev

run-prod:
	flutter run -t lib/main_prod.dart --dart-define=API_URL=$(API_URL)

codegen:
	dart run build_runner build --delete-conflicting-outputs

analyze:
	flutter analyze

test:
	flutter test

check: codegen analyze test
