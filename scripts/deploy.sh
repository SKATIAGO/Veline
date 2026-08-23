#!/usr/bin/env bash
# Despliegue en el VPS. Lo invoca GitHub Actions por SSH, y también sirve
# para lanzarlo a mano: ./scripts/deploy.sh
#
# Qué hace, en orden:
#   1. Guarda el commit actual, para poder volver si algo sale mal.
#   2. Trae el código nuevo.
#   3. Reconstruye y levanta.
#   4. Comprueba que el sitio responde de verdad.
#   5. Si no responde, vuelve al commit anterior y reconstruye.
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml"
# El dominio sale del .env, no va a fuego: el script debe servir igual en
# un entorno de pruebas con otro dominio.
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
SALUD="${PUBLIC_WEB_URL:-https://veline.es}/api/health"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

esperar_salud() {
  # La API aplica migraciones y siembra al arrancar, así que puede tardar.
  for i in $(seq 1 30); do
    if curl -sf --max-time 5 "$SALUD" >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
  done
  return 1
}

ANTERIOR=$(git rev-parse HEAD)
log "commit actual: ${ANTERIOR:0:8}"

log "trayendo cambios..."
git fetch --quiet origin main
NUEVO=$(git rev-parse origin/main)

if [ "$ANTERIOR" = "$NUEVO" ]; then
  log "no hay nada nuevo que desplegar"
  exit 0
fi

# El Caddyfile va montado como archivo suelto y Docker ata el montaje al
# inodo: git lo reemplaza con uno nuevo y el contenedor seguiría viendo el
# viejo. Si cambió, hay que RECREAR caddy, no basta con recargarlo.
CADDY_CAMBIO=false
if ! git diff --quiet "$ANTERIOR" "$NUEVO" -- Caddyfile; then
  CADDY_CAMBIO=true
  log "el Caddyfile cambió: caddy se recreará"
fi

git merge --ff-only origin/main
log "desplegando ${NUEVO:0:8}"

log "construyendo y levantando..."
$COMPOSE up -d --build

if [ "$CADDY_CAMBIO" = true ]; then
  $COMPOSE up -d --force-recreate caddy
fi

log "esperando a que el sitio responda..."
if esperar_salud; then
  log "✅ despliegue correcto: ${NUEVO:0:8}"
  $COMPOSE ps --format '{{.Service}}\t{{.Status}}'
  # Limpia imágenes viejas para que el disco no se llene con cada despliegue.
  docker image prune -f >/dev/null 2>&1 || true
  exit 0
fi

log "🛑 el sitio NO responde tras el despliegue. Volviendo a ${ANTERIOR:0:8}"
git reset --hard "$ANTERIOR"
$COMPOSE up -d --build
$COMPOSE up -d --force-recreate caddy

if esperar_salud; then
  log "revertido correctamente: el sitio vuelve a estar en pie con ${ANTERIOR:0:8}"
else
  log "⚠️ el sitio sigue caído incluso tras revertir. Hace falta mirarlo a mano."
fi
exit 1
