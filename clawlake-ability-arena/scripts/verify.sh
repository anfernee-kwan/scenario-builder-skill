#!/usr/bin/env bash
set -euo pipefail
echo "== build & up (postgres+web+engine) =="
docker compose up -d --build
echo "== wait postgres =="
for i in $(seq 1 30); do docker compose exec -T postgres pg_isready -U clawlake >/dev/null 2>&1 && break; sleep 2; done
echo "== push schema =="
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5433/abilityarena npm run db:push
echo "== wait web health =="
for i in $(seq 1 30); do curl -fsS http://localhost:3000/api/health >/dev/null 2>&1 && { echo healthy; break; }; sleep 2; done
echo "== skill.md (real HTTP) =="; curl -fsS http://localhost:3000/skill/ability-arena | head -5
echo "== agent.json (real HTTP) =="; curl -fsS http://localhost:3000/.well-known/agent.json; echo
echo "== engine running? (logs) =="; docker compose logs engine | tail -3
echo "== stop engine so host test suite owns the DB (no concurrent ticking) =="
docker compose stop engine
echo "== tests =="; DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5433/abilityarena npm test
echo "VERIFY OK"
