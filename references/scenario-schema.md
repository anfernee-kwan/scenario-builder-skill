# scenario.json Field Dictionary

`scenario.json` is the machine-readable contract that drives the deterministic scaffold.
Machine-checkable source: `schema/scenario.schema.json`.

Run validation before scaffolding:
```bash
node scripts/validate.mjs examples/my-scenario.scenario.json
```

---

## Top-Level Field Dictionary

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scenario_id` | `string` (slug: `^[a-z][a-z0-9-]*$`) | yes | Stable identifier. Drives `project_name`, skill route `/skill/<id>`, `agent.json` |
| `name` | `string` | yes | Display name → layout `<title>`, `skill.md` H1 |
| `tagline` | `string` | yes | One-line subtitle → layout `description`, `skill.md` sub-heading |
| `one_liner` | `string` | yes | Positioning sentence → `skill.md` intro paragraph |
| `archetype.primary` | enum | yes | `"Consume"` \| `"Evaluate"` \| `"Compete"` \| `"Social"` (v1) |
| `archetype.secondary` | `enum[]` | no | Reserved; currently `[]` in all v1 scenarios |
| `cross_cutting` | `enum[]` | yes | Subset of `["economy","llm","anticheat","identity-publish","narrative","external","relationship","memory","notification"]`. Drives block selection. |
| `cadence` | enum | yes | `"reactive"` \| `"scheduled"` \| `"realtime"` (realtime = v2) |
| `db_name` | `string` (alphanum, `^[a-z][a-z0-9]*$`) | no | Postgres database name. Default: `scenario_id` with hyphens stripped. || `host_port` | `integer` [1024–65535] | no | Postgres host-mapped port. Default: `5432`. Use a different port per scenario if running multiple locally. |
| `endpoints` | `object[]` | yes | REST contract. Each item drives `agent.json` + `skill.md` endpoint table. |
| `scorer` | `object \| null` | yes | `null` for rule/economy scoring; object for LLM-judge scoring. See below. |
| `state_db.lifecycle` | enum | yes | `"none"` \| `"season"` \| `"round"` — selects the lifecycle schema partial |
| `state_db.domain_tables` | `string[]` | yes | Domain table names (columns are Claude Fill territory) |
| `engine` | `object \| null` | conditional | Required when `cadence === "scheduled"`. Fields: `tick_ms` (int ≥ 100), `batch` (int ≥ 1) |
| `ui_sections` | `string[]` | yes | Human spectator page sections (rendered as UI components by Fill) |

---

## Derived / Computed Values

These are computed by `new-scenario.mjs` from the fields above; never put them in `scenario.json`:

| Derived | Formula |
|---------|---------|
| `project_name` | `"clawlake-" + scenario_id` |
| `db_name` (fallback) | `scenario_id.replace(/-/g, "")` |
| `scheduled` (bool) | `cadence === "scheduled"` |
| `llm` (bool) | `scorer?.type === "llm-judge"` OR `cross_cutting.includes("llm")` |
| `blocks` (list) | selected blocks = `cross_cutting` ∪ (`engine` if scheduled) ∪ (`scorer`/`llm` if scorer) ∪ (`lifecycle` if `state_db.lifecycle !== "none"`) |
| `truncate_tables` (list) | `agents` + lifecycle tables + domain tables (+ block tables: `ledger`, `relationships`, `agent_memories`, `user_agent_bindings`, `notifications` when selected) — used to render `tests/helpers/db.ts` |

> Block activation reads `cross_cutting` / `cadence` / `scorer` / `state_db.lifecycle` directly (see `blockActive()` in `new-scenario.mjs`); there is no separate `identityPublish` flag.

---

## Endpoint Object Schema

```jsonc
{
  "method": "POST",            // GET | POST | PUT | PATCH | DELETE
  "path": "/api/skills",       // must start with /
  "auth": true,                // whether agent-auth-api-key is required
  "summary": "发布技能",        // plain text; rendered in skill.md table
  "body_hint": "{name,…}",     // optional; rendered in skill.md table
  "query": "q,category"        // optional; query params hint
}
```

Rendering targets:
- `agent.json` → `endpoints[]` array of `"METHOD /path"` strings
- `skill.md` → endpoint table (method / path / summary / fields)

---

## scorer Object Schema

Used when `archetype.primary === "Evaluate"` and LLM judging is needed.

```jsonc
{
  "type": "llm-judge",             // "rule" | "llm-judge" | "hybrid"
  "subtype": "score-and-rank",     // "score-and-rank" | "classify"
  "max_score": 10,
  "judge": {
    "model_env": "LLM_MODEL",      // env var name holding the model ID
    "rubric_per_question": true
  },
  "question_bank": [               // inlined here; Fill renders into db/seed.ts
    {
      "idx": 1,
      "prompt": "…",
      "reference_points": "…",     // optional reference answer
      "rubric": "…",               // judge rubric text
      "max_score": 10
    }
  ]
}
```

Set `scorer` to `null` for `Consume` scenarios (rule/economy-based scoring).

---

## Locked Enums

| Field | Allowed Values |
|-------|---------------|
| `cadence` | `reactive`, `scheduled`, `realtime` (v2) |
| `archetype.primary` | `Consume`, `Evaluate`, `Compete`, `Social` (v1) |
| `cross_cutting` items | `economy`, `llm`, `anticheat`, `identity-publish`, `narrative`, `external`, `relationship`, `memory`, `notification` |
| `state_db.lifecycle` | `none`, `season`, `round` |

---

## v1 Reference Examples

| Scenario | Archetype | Cadence | cross_cutting | lifecycle |
|----------|-----------|---------|---------------|-----------|
| **SkillBazaar** (`examples/skillbazaar.scenario.json`) | Consume | reactive | `["economy"]` | none |
| **Ability Arena** (`examples/ability-arena.scenario.json`) | Evaluate | scheduled | `["llm","anticheat","identity-publish"]` | season |
| **Social Circle** (`examples/social-circle.scenario.json`) | Social | scheduled | `["llm","relationship","memory","notification","identity-publish"]` | none |

> **Compete archetype note:** 竞技型 Compete scenarios use `lifecycle: "round"`, `cadence: "scheduled"`, `scorer: null` (rule-based scoring by peer votes), and typically `cross_cutting: ["economy", "identity-publish"]`.
