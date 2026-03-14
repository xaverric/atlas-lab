#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# --- Mode detection -----------------------------------------------------------

MODE="${1:-dev}"
RESET=false

case "$MODE" in
  dev|development) MODE="dev" ;;
  prod|production) MODE="prod" ;;
  *)
    echo "Usage: $0 [dev|prod] [--reset]"
    echo "  dev   — docker-compose.dev.yml  (default)"
    echo "  prod  — docker-compose.yml"
    echo "  --reset  — stop everything and wipe volumes before starting"
    exit 1
    ;;
esac

shift || true
for arg in "$@"; do
  case "$arg" in
    --reset) RESET=true ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

if [ "$MODE" = "dev" ]; then
  COMPOSE="docker compose -f docker-compose.dev.yml"
else
  COMPOSE="docker compose -f docker-compose.yml"
fi

# --- Colors / helpers ---------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step()  { echo -e "\n${GREEN}=> $1${NC}"; }
info()  { echo -e "${YELLOW}   $1${NC}"; }
warn()  { echo -e "${RED}   $1${NC}"; }

wait_for_port() {
  local port=$1 name=$2
  local i=0
  until nc -z localhost "$port" 2>/dev/null; do
    i=$((i + 1))
    if [ $i -gt 60 ]; then
      echo "ERROR: $name did not start within 60s" >&2
      exit 1
    fi
    sleep 1
  done
  info "$name ready (port $port)"
}

wait_for_url() {
  local url=$1 name=$2 timeout=${3:-120}
  local i=0
  printf "   Waiting for %s " "$name"
  until curl -4 -sf --connect-timeout 3 "$url" &>/dev/null; do
    i=$((i + 3))
    if [ $i -gt "$timeout" ]; then
      echo ""
      echo "ERROR: $name did not become healthy within ${timeout}s" >&2
      exit 1
    fi
    printf "."
    sleep 3
  done
  echo ""
  info "$name ready"
}

# --- Reset (optional) --------------------------------------------------------

if [ "$RESET" = true ]; then
  echo ""
  warn "This will stop ALL containers and DELETE ALL volumes (databases, files, etc.)"
  warn "Mode: $MODE"
  echo ""
  read -rp "   Are you sure? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi

  step "Stopping all containers and removing volumes"
  $COMPOSE down -v --remove-orphans 2>/dev/null || true
else
  step "Stopping existing containers"
  $COMPOSE down --remove-orphans 2>/dev/null || true
fi

# --- Infrastructure -----------------------------------------------------------

step "Starting databases (keycloak-db, mongodb, redis, minio)"
$COMPOSE up -d keycloak-db mongodb redis minio

wait_for_port 27017 "MongoDB"
wait_for_port 5432  "Keycloak DB"
wait_for_port 6379  "Redis"
wait_for_port 9000  "MinIO"

step "Starting Keycloak (realm import on first boot — may take up to 3 min)"
$COMPOSE up -d keycloak

wait_for_url "http://127.0.0.1:8080/realms/atlas" "Keycloak (atlas realm)" 180

# --- Init (only on reset) ----------------------------------------------------

if [ "$RESET" = true ]; then
  step "Running atlas-init (users, roles, realm settings, MinIO buckets)"
  (cd .. && npm run init -- --inventory localhost --dataset atlas-dev)
fi

# --- Application services ----------------------------------------------------

if [ "$MODE" = "dev" ]; then
  step "Installing npm dependencies (shared volume)"
  $COMPOSE run --rm installer
fi

step "Starting all application services"
$COMPOSE up -d

# --- Summary ------------------------------------------------------------------

step "Done! [$MODE mode]"
if [ "$MODE" = "dev" ]; then
  echo "  Keycloak:        http://localhost:8080"
  echo "  Atlas Core:      http://localhost:4000"
  echo "  Atlas DMS:       http://localhost:4001"
  echo "  Atlas Scheduler: http://localhost:4002"
  echo "  Atlas Notify:    http://localhost:4003"
  echo "  Atlas GUI:       http://localhost:3000"
  echo "  MinIO Console:   http://localhost:9001"
  echo "  MongoDB:         localhost:27017"
  echo "  Redis:           localhost:6379"
else
  echo "  All services started behind Traefik."
  echo "  Check status: docker compose -f docker-compose.yml ps"
fi
