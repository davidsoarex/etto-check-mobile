#!/usr/bin/env bash
set -euo pipefail

APP="${1:?Informe cardapio, entregas, colaborador ou check}"
STAGING="${2:?Informe o diretório com o build (index.html)}"

case "${APP}" in
  cardapio | entregas | colaborador | check) ;;
  *)
    echo "ERRO: app invalido (${APP})"
    exit 1
    ;;
esac

if [ ! -f "${STAGING}/index.html" ]; then
  echo "ERRO: ${STAGING}/index.html nao encontrado"
  exit 1
fi

DEPLOY_ROOT="/var/www/etto-${APP}"
RELEASES="${DEPLOY_ROOT}/releases"
NEW="${RELEASES}/$(date -u +%Y%m%dT%H%M%SZ)-$$"
CURRENT="${DEPLOY_ROOT}/current"

mkdir -p "${RELEASES}"
mkdir -p "${NEW}"
rsync -a --delete "${STAGING}/" "${NEW}/"
chmod -R a+rX "${NEW}"
ln -sfn "${NEW}" "${CURRENT}"

ls -1dt "${RELEASES}"/* 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "OK: ${APP} publicado em ${CURRENT} (-> ${NEW})"
