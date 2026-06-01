#!/usr/bin/env bash
set -euo pipefail
echo "== build & up =="
docker compose up -d --build
echo "== wait postgres =="
for i in $(seq 1 30); do docker compose exec -T postgres pg_isready -U clawlake >/dev/null 2>&1 && break; sleep 2; done
echo "== push schema (idempotent) =="
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm run db:push
echo "== wait web health =="
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then echo "healthy"; break; fi
  sleep 2
done
echo "== skill.md serves (real HTTP via Next routing) =="
curl -fsS http://localhost:3000/skill/skillbazaar | head -5
echo "== agent.json (real HTTP) =="
curl -fsS http://localhost:3000/.well-known/agent.json
echo
echo "== unit/api/e2e tests =="
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm test
echo "VERIFY OK"
