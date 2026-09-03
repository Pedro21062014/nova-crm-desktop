#!/usr/bin/env bash
# Constroi e testa o Flatpak do Nova CRM localmente.
#
# Uso:
#   ./build.sh 2.9.0            # baixa o tar.gz do release e constroi + instala
#   ./build.sh 2.9.0 --bundle   # constroi e gera tambem um arquivo .flatpak
#
# Requisitos:
#   sudo apt install flatpak flatpak-builder
#   flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

set -euo pipefail

VERSION="${1:?Informe a versao, ex: ./build.sh 2.9.0}"
WANT_BUNDLE="${2:-}"
APP_ID="br.com.novacrm.NovaCRM"
RUNTIME_VERSION="25.08"
REPO="Pedro21062014/nova-crm-desktop"

cd "$(dirname "$0")"

echo "==> Instalando runtime/SDK/base app (pode demorar na 1a vez)"
flatpak install -y --user flathub \
  "org.freedesktop.Platform//${RUNTIME_VERSION}" \
  "org.freedesktop.Sdk//${RUNTIME_VERSION}" \
  "org.electronjs.Electron2.BaseApp//${RUNTIME_VERSION}"

echo "==> Baixando nova-crm-${VERSION}.tar.gz"
TARBALL="/tmp/nova-crm-${VERSION}.tar.gz"
curl -fsSL -o "$TARBALL" \
  "https://github.com/${REPO}/releases/download/v${VERSION}/nova-crm-${VERSION}.tar.gz"

SHA256=$(sha256sum "$TARBALL" | cut -d' ' -f1)
echo "==> sha256: ${SHA256}"

echo "==> Gerando manifesto ${APP_ID}.yml"
sed -e "s/@VERSION@/${VERSION}/g" -e "s/@SHA256@/${SHA256}/g" \
  "${APP_ID}.yml.in" > "${APP_ID}.yml"

echo "==> Construindo com flatpak-builder"
rm -rf build repo
flatpak-builder --user --force-clean --install-deps-from=flathub \
  build "${APP_ID}.yml"

if [ "$WANT_BUNDLE" = "--bundle" ]; then
  echo "==> Gerando bundle ${APP_ID}-${VERSION}.flatpak"
  flatpak build-bundle ~/.local/share/flatpak/repo \
    "${APP_ID}-${VERSION}.flatpak" "${APP_ID}" stable
  echo "==> Pacote pronto: flatpak/${APP_ID}-${VERSION}.flatpak"
  echo "    Instalar em outra maquina: flatpak install --user ${APP_ID}-${VERSION}.flatpak"
else
  echo "==> Instalando localmente"
  flatpak-builder --user --install --force-clean build "${APP_ID}.yml"
  echo "==> Execute com: flatpak run ${APP_ID}"
fi
