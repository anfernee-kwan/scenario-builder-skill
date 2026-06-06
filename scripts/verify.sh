#!/usr/bin/env bash
# verify.sh — docker-stack smoke for a GENERATED ClawLake scenario app.
#
# Usage:  bash scripts/verify.sh <generated-app-dir>
#         (defaults to current directory if omitted)
#
# Requirements:
#   - Port 3000 must be free. If another scenario's web container is running,
#     stop it first (docker compose stop web) before running this script.
#   - node, npm, docker compose must be on PATH.
#   - Run from within the scenario-builder-skill repo (or any location — the
#     script cd's into the app dir before doing anything).
#
set -euo pipefail

APP_DIR="${1:-.}"

echo "== reading scenario.json from ${APP_DIR} =="
if [ ! -f "${APP_DIR}/scenario.json" ]; then
  echo "ERROR: ${APP_DIR}/scenario.json not found" >&2
  exit 1
fi

# Parse scenario.json with node (no jq dependency)
DB_NAME=$(node -e "const s=require('${APP_DIR}/scenario.json'); console.log(s.db_name || s.scenario_id.replace(/-/g,''))")
HOST_PORT=$(node -e "const s=require('${APP_DIR}/scenario.json'); console.log(s.host_port || 5432)")
SCENARIO_ID=$(node -e "const s=require('${APP_DIR}/scenario.json'); console.log(s.scenario_id)")
IS_SCHEDULED=$(node -e "const s=require('${APP_DIR}/scenario.json'); console.log(s.cadence === 'scheduled' ? '1' : '0')")

echo "  scenario_id : ${SCENARIO_ID}"
echo "  db_name     : ${DB_NAME}"
echo "  host_port   : ${HOST_PORT}"
echo "  scheduled   : ${IS_SCHEDULED}"

cd "${APP_DIR}"

echo "== build & up =="
docker compose up -d --build

echo "== wait postgres healthy =="
for i in $(seq 1 30); do
  docker compose exec -T postgres pg_isready -U clawlake >/dev/null 2>&1 && break
  sleep 2
done

echo "== wait migrate service completes (db:push + seed) =="
for i in $(seq 1 60); do
  STATUS=$(docker compose ps migrate --format json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['State'] if d else 'pending')" 2>/dev/null || echo "pending")
  if [ "${STATUS}" = "exited" ]; then
    EXIT_CODE=$(docker compose ps migrate --format json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['ExitCode'] if d else 1)" 2>/dev/null || echo "1")
    if [ "${EXIT_CODE}" = "0" ]; then
      echo "migrate completed successfully"
      break
    else
      echo "ERROR: migrate service failed (exit code ${EXIT_CODE})" >&2
      docker compose logs migrate >&2
      exit 1
    fi
  fi
  sleep 2
done

echo "== wait web health =="
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "healthy"
    break
  fi
  sleep 2
done

echo "== skill.md (real HTTP) =="
curl -fsS "http://localhost:3000/skill/${SCENARIO_ID}" | head -5

echo "== agent.json (real HTTP) =="
curl -fsS http://localhost:3000/.well-known/agent.json
echo

if [ "${IS_SCHEDULED}" = "1" ]; then
  echo "== engine logs (last 3 lines) =="
  docker compose logs engine | tail -3
  echo "== stop engine so host test suite owns the DB (no concurrent ticking) =="
  docker compose stop engine
fi

echo "== tests (pretest hook 自动建 ${DB_NAME}_test，测试库与开发库隔离) =="
DATABASE_URL="postgres://clawlake:clawlake@127.0.0.1:${HOST_PORT}/${DB_NAME}" npm test

echo "VERIFY OK"
