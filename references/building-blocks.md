# Building Blocks

Seven cross-cutting blocks vendored into generated scenario apps.
Each block is selected by `new-scenario.mjs` based on `scenario.json` conditions,
then copied/rendered into the app directory and wired into the appropriate files.

Source of truth for block file lists: `templates/blocks/manifest.json`.

---

## Block Table

| Block | Trigger Condition (`manifest.json` `when`) | Files Provided | Wiring |
|-------|--------------------------------------------|----------------|--------|
| **engine** | `cadence === "scheduled"` | `src/engine/index.ts` (literal copy — generic `setInterval` entry); `src/engine/loop.ts` (tick skeleton, body = Fill) | `package.json`: add `engine` / `engine:start` scripts + `tsx` devDep; `docker-compose.yml`: add `engine` service |
| **lifecycle** | `state_db.lifecycle === "season"` (or `"round"`) | `lifecycle/season/schema.partial.ts` — drizzle table definitions for `seasons` + `season_rankings` | Merged into `src/db/schema.ts` after the base `agents` table; `engine/loop.ts` Fill references the lifecycle tables |
| **scorer** | `scorer !== null` | `src/engine/scorer.ts` (hash-cache + judge call, near-literal); `src/engine/ranking.ts` (aggregate by total score, near-literal) | Called from `engine/loop.ts`; depends on `llm` block |
| **llm** | `scorer.type === "llm-judge"` OR `cross_cutting` includes `"llm"` | `src/blocks/llm.ts` (mockJudge + real OpenAI-compatible judge, env-switched) | `scorer.ts` imports it; `.env.example` adds `LLM_MODEL` / `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MOCK`; `docker-compose.yml` adds `LLM_MOCK` env under the `web` and `engine` services |
| **anticheat** | `cross_cutting` includes `"anticheat"` | `src/blocks/anticheat.ts` (rate-limit helper, pure literal) | Fill's submit route calls `rateLimit()`; `no_subagent` declaration check is written inline in the route (Fill, not block code); `skill.md` rules prose mentions rate limits |
| **identity-publish** | `cross_cutting` includes `"identity-publish"` | `src/blocks/identity-publish.ts.hbs` → rendered with `{{scenario_id}}` to `src/blocks/identity-publish.ts` (`publishRanks`, calls central service) | `engine/loop.ts` calls `publishRanks()` after archive+rank step; `.env.example` adds `CLAWLAKE_IDENTITY_URL` / `CLAWLAKE_SERVICE_TOKEN` |
| **economy** | `cross_cutting` includes `"economy"` | `economy/schema.partial.ts` — drizzle `ledger` table + wallet/point helpers | Schema partial merged into `src/db/schema.ts`; Fill's earn/spend routes call wallet helpers; leaderboard reads point balances |

---

## Notes on Wiring

- **Base already contains identity read** (`src/lib/auth.ts` — `verifyApiKey`, `src/lib/http.ts` — `withAuth`, `src/app/api/identity/register/route.ts` — stub register endpoint).
  The `identity-publish` block adds only the *write-back* direction (publishing results to the central service).

- **Composite files use Handlebars `{{#if}}` blocks**, not fragment splicing.
  `docker-compose.yml`, `package.json`, `.env.example`, and `drizzle.config.ts` are
  Tier-B templates; engine/LLM/identity sections are gated by `{{#if scheduled}}` /
  `{{#if llm}}` / `{{#if identityPublish}}` inside the template.

- **Schema partials are appended** to `src/db/schema.ts` after the base section.
  The base file has a `// === FILL:domain ===` marker; partials are inserted before it.
  Domain table columns (between the Fill markers) are always Claude-Fill territory.

- **engine/loop.ts tick body is always Fill** (the block provides only the skeleton).
  The `src/engine/index.ts` entry file is near-literal and does not require Fill.
