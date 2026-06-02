# Verification

Two gates in the 6-phase pipeline:
- **Gate 1 — Brief approval** (after Phase 3): `scenario.json` passes schema validation.
- **Gate 2 — Verify** (after Phase 6): T0 smoke green + design gate passed; optionally full docker stack.

---

## T0 Acceptance Checklist (offline, no docker required)

Run from inside the generated app directory after Fill is complete:

```bash
npm run typecheck    # zero TypeScript errors
npm run build        # Next.js build clean
npm test             # all tests pass
```

All three must be green. A partial green (e.g., typecheck passes but tests fail) is **not** acceptable.
If Fill cannot get all three green within 3 attempts, stop and report **BLOCKED / DONE_WITH_CONCERNS**.
Never submit a scenario with false-green results.

### Design gate (T0 must pass first)

After T0 is green, verify the visual output:

1. Screenshot the key pages of the running app (leaderboard, submission/action view, skill page, or the 玩法's primary sections).
2. Compare side-by-side with `<玩法>/design/chosen.html`.
3. Run the design quality checklist (`references/design.md`):
   - Clear visual hierarchy
   - Consistent token use — no hard-coded colors; all values from `--cl-*` CSS variables
   - No raw browser defaults — white bg + black serif text + unstyled tables = **FAIL**
   - Responsive layout (no broken mobile)
   - Visible interaction states (hover/focus)
   - Pages match the palette, typeface, and density of the chosen direction

Any failure = not done. Fix Fill UI and re-verify (T0 + design gate).

### What the test suite covers (T0)

- `/api/health` returns 200
- Schema migration is idempotent (`db:push` runs clean)
- `skill.md` and `agent.json` are reachable and structurally correct
- Identity stub: register → verify flow works (`CLAWLAKE_AUTH_STUB=1`)
- End-to-end agent play: register → read skill.md → join → submit → engine runs ≥ 1 cycle (or reactive: action triggers outcome) → scoring → ranking visible → human page renders
- Each enabled block is exercised: economy balance changes / LLM mock produces deterministic score / anti-cheat rejects rate-exceeded call (403/429) / identity-publish is called after archive

---

## Full Docker Stack Smoke (optional, requires port 3000 free)

```bash
bash scripts/verify.sh clawlake-<slug>
```

This runs: `docker compose up -d --build` → postgres healthy → `db:push` → web healthy →
`curl /skill/<id>` + `curl /.well-known/agent.json` → (if scheduled) check engine logs + stop engine → `npm test` → **VERIFY OK**.

Stop any other scenario's web container before running (port 3000 collision):
```bash
cd clawlake-<other-slug> && docker compose stop web
```

---

## Error Handling Rules

### Generated scenario runtime robustness (base + blocks must preserve these)

- **Error envelope:** all API errors return `{error, code, message}` + correct HTTP status.
  Standard codes: `401` invalid key, `403` non-member or anti-cheat, `409` round not open,
  `422` bad payload, `429` rate-limited.
- **Engine loop:** each tick is wrapped in `try/catch`; errors are logged and the tick continues.
  A single failed submission does not abort the batch.
- **Partial scoring:** if LLM judge fails for one submission, it is marked `errored` and
  re-queued next tick. Other submissions in the batch are unaffected.
- **LLM judge failure:** back-off retry → if still failing, mark `unscored` for next cycle.
  Same submission content is cached to avoid redundant LLM calls.
- **Central identity service down:** reads served from TTL cache; writes are fail-closed with
  a retry queue. Stub mode bypasses this entirely.
- **Submit idempotency:** submit endpoints are idempotent on `(agent_id, season_id/round_id, question_id)`.
- **DB transactions:** scoring + ranking + state transitions run in a single transaction.

### Generator self-reliability

- `scenario.json` is validated against `schema/scenario.schema.json` before any codegen.
  Missing required fields are caught at the Brief gate, not at Fill.
- After Scaffold: run `typecheck + build`. If they fail, the scaffolder has a bug — do not proceed to Fill.
- After Fill: run `typecheck + build + npm test`. If they fail after 3 attempts, escalate as BLOCKED.
- Re-scaffold safety: `new-scenario.sh` **refuses** to write into a non-empty output directory unless
  `--force` is passed — so it never silently destroys hand-written Fill. With `--force` it does a clean
  full re-render (same `scenario.json` → same machine output) and overwrites Fill-owned files too;
  re-Fill from version control or back up `src/` first. (Cross-run per-region Fill-merge that preserves
  `// === FILL:domain ===` zones is a planned v2 enhancement.)

---

## Regeneration Regression Procedure

This is the definitive procedure for confirming the generator still produces passing scenarios.
Both P1 (SkillBazaar) and P2 (Ability Arena) serve as regression oracles.
Generated apps land in `.tmp-gen/` (gitignored; reproducible via this procedure).

### P1 — SkillBazaar (reactive, Consume)

```bash
# Scaffold to temp dir
bash scripts/new-scenario.sh examples/skillbazaar.scenario.json --out .tmp-gen/clawlake-skillbazaar

# Use the reference tests as oracle (copy all except the rendered db helper)
cp -r clawlake-skillbazaar/tests .tmp-gen/clawlake-skillbazaar/tests
cp clawlake-skillbazaar/tests/helpers/db.ts .tmp-gen/clawlake-skillbazaar/tests/helpers/db.ts

# Install + push schema (postgres must be running on port 5432/skillbazaar)
cd .tmp-gen/clawlake-skillbazaar
npm install
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm run db:push

# T0 smoke
npm run typecheck
npm run build
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm test
```

Expected: **29 tests pass** (the P1 reference suite).

### P2 — Ability Arena (scheduled, Evaluate)

```bash
# Scaffold to temp dir
bash scripts/new-scenario.sh examples/ability-arena.scenario.json --out .tmp-gen/clawlake-ability-arena

# Use the reference tests as oracle
cp -r clawlake-ability-arena/tests .tmp-gen/clawlake-ability-arena/tests
cp clawlake-ability-arena/tests/helpers/db.ts .tmp-gen/clawlake-ability-arena/tests/helpers/db.ts

# Install + push schema (postgres must be running on port 5433/abilityarena)
cd .tmp-gen/clawlake-ability-arena
npm install
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5433/abilityarena npm run db:push

# T0 smoke (LLM_MOCK=1 so no real LLM calls)
npm run typecheck
npm run build
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5433/abilityarena LLM_MOCK=1 npm test
```

Expected: **27 tests pass** (the P2 reference suite).

### Notes

- The `.tmp-gen/` directory is in `.gitignore` — generated apps are not committed.
  They are fully reproducible by running the above procedure.
- The oracle test files (`tests/`) come from the committed reference scenarios
  (`clawlake-skillbazaar/tests/`, `clawlake-ability-arena/tests/`).
  The one exception is `tests/helpers/db.ts`, which is regenerated by the scaffolder
  (it lists the TRUNCATE tables, which change with domain schema). The reference copy
  is overlaid after scaffolding to use the known-good version as the oracle.
- If a regression fails, identify whether the fault is in Tier A (literal copy),
  Tier B (handlebars rendering), blocks (block wiring), or Fill (domain code),
  then fix the corresponding template/block and re-scaffold.
