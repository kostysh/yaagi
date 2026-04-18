---
id: F-0022
title: Слой skills и процедур
status: proposed
coverage_gate: deferred
owners: ["@codex"]
area: skills
depends_on: ["F-0002", "F-0010", "F-0020"]
impacts: ["runtime", "workspace", "tooling", "skills"]
created: 2026-04-18
updated: 2026-04-18
links:
  issue: ""
  pr: []
  docs:
    - "README.md"
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/backlog/feature-candidates.md"
    - "docs/backlog/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/features/F-0010-executive-center-and-bounded-action-layer.md"
    - "docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md"
    - "docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
---

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-013
  - Backlog delivery state at intake: defined
  - Canonical backlog read used for intake:
    - `backlog-engineer status`
    - `backlog-engineer queue`
    - `backlog-engineer items --item-keys "CF-013"`
  - Supporting source traceability:
    - ../architecture/system.md
    - ../polyphony_concept.md
    - ../backlog/feature-candidates.md
    - ../backlog/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-007
    - CF-020
    - CF-023
  - Intake reconciliation note:
    - Intake follows the canonical backlog truth for `CF-013`: `delivery_state=defined`, no blockers, dependencies `CF-007`, `CF-020`, `CF-023`.
    - No backlog actualization was required during intake because the source set and dependency set remained aligned with the current backlog graph.
- **User problem:** Архитектура и концепт уже фиксируют skills как отдельный procedural layer тела, но в репозитории эта поверхность пока не оформлена как explicit owner seam. Без такого seam skills рискуют схлопнуться в ad hoc prompt wrappers, разрозненные scripts или framework-owned helper surface без versioning, activation discipline и воспроизводимого жизненного цикла.
- **Goal:** Зафиксировать отдельный dossier-owner seam для skills как repo-owned versioned procedural packages: с каноническим разделением между `seed` и materialized runtime tree, явной границей lifecycle (`create/update/activate/deprecate/evaluate`) и adapter boundary, через который runtime может потреблять skills в AI SDK-compatible форме, не забирая ownership над packaging и lifecycle.
- **Non-goals:** Это intake не переоткрывает bounded tools/action contract из `F-0010`, не материализует весь workshop/governor lifecycle для skill mutations, не определяет specialist organ retirement/promotion policy и не заменяет body-evolution seam из `F-0017`.
- **Current substrate / baseline:** `F-0002` уже поставил `seed/*` vs writable runtime boundary и materialization `workspace/skills` из `seed/skills`. `F-0010` уже владеет bounded action/tool boundary. `F-0020` и repo-level `AI SDK` ADR закрепили стабильный model/provider substrate, поэтому skills seam можно формализовать отдельно от runtime-serving реалий и без возврата к framework-owned procedural packaging.

### Terms & thresholds

- **Versioned skill seed:** Git-tracked package в `seed/skills`, который является каноническим исходником procedural capability и не должен silently подменяться runtime-generated content.
- **Materialized skill tree:** writable runtime surface в `workspace/skills`, происходящая из `seed/skills` и допускающая runtime-local state/derivatives без мутации seed boundary.
- **Skill adapter boundary:** repo-owned слой, который проецирует skill package в AI SDK-compatible prompt/tool/runtime surface, не передавая ownership над packaging, activation и lifecycle во framework.

## 2. Scope

### In scope

- Canonical owner seam для repo-owned versioned skill packages как отдельного procedural layer, а не как скрытого свойства tools, prompts или model profiles.
- Явное разделение между `seed/skills` как versioned source of truth и `workspace/skills` как materialized writable runtime tree.
- Базовый lifecycle boundary для skill packages: create, update, activate, deprecate, evaluate.
- Каноническая package shape для skill bundle и минимальные invariants вокруг `SKILL.md`, `references/`, `scripts/`, `assets/`.
- Adapter boundary, через который runtime может потреблять skills в AI SDK-compatible форме без framework ownership над lifecycle.

### Out of scope

- Полная governance/promotion policy для skill mutations, если она требует reopening broader governor or workshop contracts.
- Reopening bounded action/tool admission semantics из `F-0010`.
- Specialist-specific organ policy, release automation, support contract и perimeter/auth seams из более позднего backlog.
- Full self-modifying body evolution, worktree orchestration и Git-change approval policy beyond the skill-packaging seam itself.

### Constraints

- Skills остаются procedural layer тела и не могут становиться identity-bearing memory, narrative spine или shadow-agent substrate.
- Repo-owned packaging/lifecycle обязаны оставаться вне framework ownership; runtime вправе только адаптировать skill packages в AI SDK-compatible prompt/tool surfaces.
- Source of truth для versioned skills остаётся в Git-tracked `seed/skills`; runtime-generated outputs и mutable derivatives не должны тихо становиться tracked canonical source.
- Intake и последующие шаги должны сохранять канонический repo stack из `README.md`: `pnpm`, `Node.js 22`, `TypeScript`, `AI SDK`, root quality gates `format -> typecheck -> lint`.

### Assumptions (optional)

- Delivered prerequisites `F-0002`, `F-0010` и `F-0020` уже достаточны, чтобы формализовать skills seam без reopening baseline deployment cell, action boundary или real-serving substrate.
- Первая версия seam может оставаться file/package-oriented; обязательная DB projection для lifecycle metadata пока не считается доказанной предпосылкой intake.

### Open questions (optional)

- Какой минимальный lifecycle state model нужен feature-local seam: достаточно ли `draft/active/deprecated`, или evaluation/quarantine требуют отдельного canonical state? Owner: future `spec-compact`. needed_by: before_planned.
- Что именно считается activation proof для skill package: presence in materialized tree, successful adapter projection, explicit runtime registry entry или их комбинация? Owner: future `spec-compact`. needed_by: before_planned.
- Где проходит граница между skill-local evaluation и workshop/governor-owned review path, чтобы `CF-013` не поглотил чужой lifecycle? Owner: future `spec-compact`. needed_by: before_planned.

## 3. Requirements & Acceptance Criteria (SSoT)

## 4. Non-functional requirements (NFR)

## 5. Design (compact)

### 5.1 API surface

- Intake не вводит новый public HTTP/API surface.
- Ожидаемая boundary surface этой фичи находится между versioned skill package, materialized runtime tree и repo-owned adapter layer, а не в operator-facing route family.

### 5.2 Runtime / deployment surface

- Runtime surface стартует от уже delivered boundary `seed/skills -> workspace/skills`.
- `polyphony-core` остаётся потребителем materialized skills и adapter projections, но не владельцем packaging/lifecycle.
- Если later slices изменят startup/materialization contract, они обязаны сохранить repo-level verification split: targeted local verification plus containerized smoke path для runtime-affecting changes.

### 5.3 Data model changes

- Intake пока не фиксирует обязательную DB schema change.
- На `spec-compact` нужно явно решить, остаётся ли lifecycle metadata file-backed inside skill packages или ей нужен отдельный projected registry/state surface.

### 5.4 Edge cases and failure modes

- Runtime-generated skill output не должен silently мутировать versioned seed package.
- Нельзя считать plain prompt snippet или ad hoc script полноценным skill package без canonical lifecycle boundary.
- Adapter projection не должен превращаться в скрытый owner seam, который замещает repo-owned package truth.

### 5.5 Verification surface / initial verification plan

- Initial local proof surface ожидаемо покроет package-shape validation, seed/materialized separation и adapter-boundary invariants.
- Если implementation затронет startup/materialization runtime path, обязательным останется containerized smoke path из repo overlay.

### 5.6 Representation upgrades (triggered only when needed)

- На `spec-compact` вероятны lifecycle state list и decision table для activation/evaluation boundary.

### 5.7 Definition of Done

- У feature есть явный owner seam для versioned skill packaging и lifecycle boundary.
- Разделение `seed/skills` и `workspace/skills` сохранено как canonical invariant.
- Runtime adapter boundary описан так, чтобы не передавать framework ownership над skills lifecycle.
- Downstream stages закрывают unresolved questions про lifecycle states, activation proof и evaluation/governor boundary без silent scope drift.

### 5.8 Rollout / activation note (triggered only when needed)

- Вероятно потребуется, если activation/deprecation semantics skill packages начнут менять admitted runtime behavior или startup/materialization order.

## 6. Slicing plan (2–6 increments)

## 7. Task list (implementation units)

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|

## 9. Decision log (ADR blocks)

## 10. Progress & links

- Backlog item key: CF-013
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Next expected workflow step: `spec-compact`
- Intake log: skipped unless a later trigger appears in the same intake cycle
- Issue:
- PRs:

## 11. Change log

- 2026-04-18: Initial dossier created from backlog item `CF-013` at backlog delivery state `defined`.
