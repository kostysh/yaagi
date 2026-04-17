# Retrospective

Status: validated_by_agent

## Scope

- Анализируемый след: `<session-trace:019d95c3>`
- Граница анализа: строки `1..17342`
- Исключено из primary scope: сама ретроспектива и всё, что произошло после пользовательского запроса на неё, начиная со строки `17343`
- Сессионная фаза: от первого вопроса о backlog до полного закрытия `F-0021`
- Основные work items: `CF-023 / F-0020`, `CF-028 / F-0021`, а также промежуточный `change-proposal` по `F-0007`

## Executive summary

Сессия закончилась результативно: были закрыты `F-0020` и `F-0021`, а backlog items `CF-023` и `CF-028` дошли до `implemented`. При этом цена результата оказалась выше, чем должна была быть, из-за двух системных ошибок в способе работы.

Первая ошибка была процессной: в самом начале ответ о backlog был частично обогащён чтением `<project-root>/docs/backlog/.backlog/state.json` вместо канонического `queue -> items`. Это не сломало фактический ответ, но сломало trust contract между оператором и навыком. Инцидент был признан сразу, а затем оформлен в отдельный issue для `dossier-engineer`: `<skills-root>/dossier-engineer/docs/issues/improvement-proposal-20260416-1.md`.

Вторая ошибка была инженерной: полный `pnpm smoke:cell` использовался как debug loop для real `Gemma/vLLM` path. Именно это привело к повторным зависаниям хоста, ручным перезагрузкам и существенной потере времени. Позже выяснилось, что smoke-harness до `F-0021` всё ещё дублировал тяжёлый runtime по family boundary и слишком дорого оркестрировал steady-state проверки. Исправление этой проблемы потребовало вынести follow-up в отдельный backlog item `CF-028` и довести его до полноценной реализации в `F-0021`.

Самый сильный позитивный фактор в сессии: независимые внешние аудиты действительно работали как fail-closed контур. Они не были формальностью: несколько раз находили реальные ошибки в intake closeout, spec contract, backlog mutation trail, implementation closeout и runtime-proof obligations, после чего вносились корректные reround fixes.

## Evidence manifest

### Primary evidence

- Session trace: `<session-trace:019d95c3>`
- Feature dossiers:
  - `<project-root>/docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md`
  - `<project-root>/docs/features/F-0021-smoke-harness-post-f0020-runtime-optimization.md`
- Stage logs, вручную провалидированные по trace-linked paths:
  - `<project-root>/.dossier/logs/F-0020/feature-intake-c01.md`
  - `<project-root>/.dossier/logs/F-0020/spec-compact-c01.md`
  - `<project-root>/.dossier/logs/F-0020/plan-slice-c01.md`
  - `<project-root>/.dossier/logs/F-0020/implementation-c01.md`
  - `<project-root>/.dossier/logs/F-0021/spec-compact-c01.md`
  - `<project-root>/.dossier/logs/F-0021/plan-slice-c01.md`
  - `<project-root>/.dossier/logs/F-0021/implementation-c01.md`
- Final closeout artifacts:
  - `<project-root>/.dossier/reviews/F-0020/implementation-741f9cec9f35.json`
  - `<project-root>/.dossier/reviews/F-0021/implementation-00442ef55561.json`
  - `<project-root>/.dossier/steps/F-0020/implementation.json`
  - `<project-root>/.dossier/steps/F-0021/implementation.json`
- Timing evidence:
  - `<project-root>/.dossier/evidence/F-0021/implementation-smoke-timing-c01.json`
- Cross-skill issue:
  - `<skills-root>/dossier-engineer/docs/issues/improvement-proposal-20260416-1.md`

### Data-quality note

Автоматический `scan` недоснял stage-log linkage и показал `Logs analyzed: 0`, хотя trace явно содержит создание и изменение stage-log файлов. Поэтому stage logs и rerounds в этом отчёте валидированы вручную по trace-linked paths и финальным артефактам. Confidence по фактуре остаётся `medium-high`, но качество auto-linking у retrospective CLI в этой сессии недостаточное.

## Timeline

1. `2026-04-16 18:23Z` - старт с вопроса о backlog.  
   Trace line `6`: оператор просит показать статус и очередь.  
   Trace lines `69-81`: после `queue`/`status` агент читает `.backlog/state.json` и отвечает неканонически.

2. `2026-04-16 18:26Z-18:32Z` - оператор останавливает shortcut и требует объяснение.  
   Trace lines `86-146`: признание ошибки, формулировка fail-closed правила, затем создание issue в skill docs.

3. `2026-04-16 18:36Z-20:39Z` - канонический intake/spec/plan для `CF-023 / F-0020`.  
   Trace lines `239-1242`, `1554-1811`: feature intake, внешние аудиты, исправление английского stage-log, shortlist update и plan-slice.

4. `2026-04-16 22:43Z-2026-04-17 15:56Z` - тяжёлая implementation-фаза `F-0020`.  
   Здесь происходят реальные runtime-debug циклы: `Gemma/vLLM`, `HF_TOKEN`, cache policy, structured output sanitation, repeated smoke runs, operator complaints about re-downloads and system freezes.

5. `2026-04-17 15:15Z-17:19Z` - осознание архитектурной проблемы smoke-harness и вынос follow-up в отдельный carrier.  
   Trace lines `11792-14027`: идентификация второго `Gemma` runtime, change-proposal по `F-0007`, correction of bad backlog mutation patch, extraction into `CF-028`.

6. `2026-04-17 17:42Z-20:38Z` - полный lifecycle `F-0021`: intake -> spec -> plan -> implementation -> closure.  
   Trace lines `14100-17230`: новый dossier, несколько независимых audit rerounds, implementation smoke tuning, explicit `pg` timeout boundary, final PASS.

## Validated incidents

### 1. Неканонический backlog read в первом же ответе

- Severity: high
- Evidence:
  - trace lines `69-81`
  - trace lines `86-146`
  - `<skills-root>/dossier-engineer/docs/issues/improvement-proposal-20260416-1.md`
- What happened:
  - после корректного `queue` агент не вызвал `items --item-keys ...`, а дочитал `<project-root>/docs/backlog/.backlog/state.json` для enrichment
- Why it matters:
  - это process correctness failure, а не formatting miss
  - такой shortcut размывает canonical read surface `backlog-engineer`
- Fix applied in session:
  - ошибка была признана явно
  - дальнейшие backlog reads делались канонически
  - создан отдельный issue для доработки cross-skill guidance

### 2. Полный `smoke:cell` использовался как debug loop на real `Gemma/vLLM`

- Severity: critical
- Evidence:
  - trace lines `4576`, `11673`, `15355`
  - trace lines `15910`, `15927`
  - `<project-root>/.dossier/logs/F-0020/implementation-c01.md`
  - `<project-root>/.dossier/logs/F-0021/implementation-c01.md`
- What happened:
  - тяжёлый containerized smoke гонялся повторно во время отладки реального serving path
  - хост несколько раз зависал намертво, оператор был вынужден делать reset
- Why it matters:
  - был потерян контроль над тем, какие процессы и контейнеры пережили aborted turns
  - verification path стал опаснее самой разрабатываемой функциональности
- Root cause:
  - дорогой smoke использовался не как final gate, а как рабочий цикл
  - smoke topology на тот момент ещё дублировала тяжёлый runtime по family boundary
- Fix applied in session:
  - был проведён targeted debug
  - найден архитектурный дефект со вторым `Gemma` runtime
  - follow-up вынесен в отдельный `CF-028 / F-0021`

### 3. Closeout truth несколько раз опережал фактически завершённый process bundle

- Severity: high
- Evidence:
  - trace lines `12445`, `12626`, `13281-13851`
  - trace lines `16660`, `16983`, `17230`
  - `<project-root>/.dossier/reviews/F-0021/implementation-00442ef55561.json`
- What happened:
  - внешние аудиты несколько раз ловили ситуацию, где scope по смыслу уже считался закрытым, но backlog/dossier/proof trail ещё не был согласован
- Why it matters:
  - это не cosmetic issue: именно так появляются ложные `done` и нереплейбимые backlog mutations
- Root cause:
  - слишком ранний переход от “дерево выглядит правильно” к “можно закрывать step”
  - недостаточно жёсткое разделение между intended tree и machine-closed tree
- Fix applied in session:
  - rerounds после каждого audit finding
  - явное закрытие через verify/review/step-close
  - исправление bad patch trail для `F-0007` / `CF-028`

### 4. Contract вокруг model cache и загрузки весов был недостаточно явно зафиксирован заранее

- Severity: medium
- Evidence:
  - trace lines `6173`, `9233`, `11276`
  - `<project-root>/.dossier/logs/F-0020/implementation-c01.md`
  - `<project-root>/.dossier/evidence/F-0021/implementation-smoke-timing-c01.json`
- What happened:
  - оператор несколько раз отдельно требовал не скачивать веса повторно
  - до фикса persistent reuse это было operator-facing pain point
- Why it matters:
  - это прямой cost/traffic risk для real-model workflows
- Fix applied in session:
  - persistent reuse был доведён до explicit contract
  - final timing evidence уже явно говорит `warm models_state and HF cache; no repeated weight download`

### 5. Автоматический retrospective scan недооценил реальные инциденты и stage-log usage

- Severity: medium
- Evidence:
  - `<project-root>/.dossier/retro/session-019d95c3/retrospective-20260416-182331-019d95c3/scan-summary.json`
- What happened:
  - `scan` собрал touched paths, но не связал их с `stageLogs` и `reviewArtifacts`
  - из-за этого draft reports вышли слишком стерильными
- Why it matters:
  - ретроспектива без ручной валидации дала бы ложную картину “candidate incidents: 0”
- Fix applied in session:
  - manual validation and rewrite of all three retrospective artifacts

## Stage analysis

### Backlog selection and intake

Стадия стартовала плохо из-за нарушения canonical read path, но восстановилась быстро. После пользовательского замечания поведение стало дисциплинированным: дальнейшие reads шли через `status`, `queue`, `items`, `attention`, а проблема была оформлена не только локальным извинением, но и skill-level issue.

### Spec and planning

Это была самая сильная часть сессии. И `F-0020`, и `F-0021` прошли через серию независимых review rerounds, которые реально усилили contract. Отдельно полезным оказалось явное требование вести `.dossier/logs` на языке оператора: после замечания от пользователя это правило больше не нарушалось.

### Implementation

Технически implementation была продуктивной, но процессно нестабильной. Для `F-0020` было найдено и исправлено несколько реальных runtime seams: Gemma ROCm image mismatch, structured output sanitization, endpoint echo normalization, cache reuse, fail-closed dependency truth. Но verification strategy долго была неверной: вместо узких checks использовался full smoke, что и дало самые дорогие инциденты этой сессии.

Для `F-0021` implementation уже шла заметно лучше: проблема была заранее локализована в harness orchestration, решения укладывались в четыре согласованных пункта, а итоговые timing evidence показали реальное улучшение.

### Review and closure

Это ещё одна сильная сторона сессии. Независимые audit agents несколько раз возвращали `FAIL`, и каждый такой `FAIL` оказывался полезным. Важное наблюдение: основная польза шла не от первого PASS, а от тех rerounds, которые ломали слишком ранние closure claims.

## Skill analysis

### `backlog-engineer`

Skill сам по себе дал правильный contract, но cross-skill guardrail оказался недостаточно fail-closed. Поэтому агент после корректного `queue` всё равно смог срезать угол через `.backlog/state.json`. Командная поверхность была достаточной; проблема была именно в interop discipline.

### `dossier-engineer`

Skill оказался полезным как carrier строгого workflow: intake/spec/plan/implementation действительно закрывались через verify/review/step-close, а внешние аудиты не были формальностью. При этом сессия показала два улучшения, которые нужны skill ecosystem:

- более жёсткое правило для canonical backlog reads в mixed-skill repos;
- более явная фиксация того, что closeout intent нельзя путать с process-complete state.

### Независимые audit agents

Это самый ценный operational инструмент сессии. Агентные rerounds нашли:

- незакрытый intake process bundle;
- неполный AC/spec contract;
- bad backlog mutation trail;
- premature closeout claims;
- отсутствие explicit timeout boundary на direct `pg` path;
- stale diff fingerprint в timing evidence.

Без этих аудитов сессия завершилась бы формально “успешно”, но с несколькими скрытыми процессными и runtime дефектами.

### `retrospective-phase-analysis`

Skill полезен как стартовая рамка, но в текущем виде недотягивает до fully trusted automatic report generation. Он хорошо строит scope и bundle root, но пока слабо связывает trace-changed paths с реальными stage logs и review artifacts. Для этой сессии auto-draft без ручной правки был бы misleading.

## Logging review

### What worked

- Русские stage logs после пользовательского замечания вели narrative достаточно ясно.
- Verify/review/step-close artifacts позволяют восстановить финальный truth по `F-0020` и `F-0021`.
- Timing evidence для `F-0021` уже годится как durable before/after reference.

### What was missing

- Нет единого machine-readable incident ledger для runtime crashes, host resets, repeated downloads и operator-side screenshots.
- Stage logs не содержат trace line anchors или tool-run ids, поэтому retrospective CLI не смогла автоматически собрать их в `stageLogs`.
- Не хватает явного поля, которое отделяет `closeout intent` от `process_complete`.
- Heavy verification runs не пишут стандартизированный resource envelope: warm/cold cache, active services, expected memory-pressure class, allowed retry budget.

## Recommendations

1. Закрыть cross-skill backlog guidance fail-closed правилом `queue -> items`, без права читать `.backlog/*` для operator-facing truth.  
   Status in this session: issue already filed.

2. Зафиксировать правило “full smoke is a release gate, not a debug loop” в repo-level workflow или в runtime-related dossier guidance.  
   До final smoke должны идти узкие runtime checks и targeted probes.

3. Добавить в stage logs machine-readable incident fields:
   - `incident_id`
   - `incident_category`
   - `host_reset`
   - `cache_policy`
   - `resource_pressure_note`
   - `trace_anchor_lines`

4. Добавить явное process field pair в dossier logs и closure helpers:
   - `closeout_intent`
   - `process_complete`
   Это уменьшит риск преждевременных claims.

5. Улучшить `retrospective-phase-analysis` scan:
   - auto-link stage logs from trace-changed paths
   - auto-detect review/verification/step artifacts for mentioned feature ids
   - surface candidate incidents from user-reported resets and aborted turns

## Final assessment

Сессия была тяжёлой и местами дорогой по operator friction, но в инженерном смысле полезной. В ней были не только исправлены `F-0020` и `F-0021`, но и вскрыты слабые места сразу трёх контуров:

- backlog/dossier interop
- smoke verification strategy for heavy local runtimes
- retrospective observability itself

Итог нельзя назвать “чистой” сессией, но её можно назвать продуктивной сессией с высоким объёмом извлечённого процессного знания. Самый важный вывод: успех в конце этой цепочки был обеспечен не тем, что работа с первого раза шла правильно, а тем, что в сессии был сохранён fail-closed контур через audits, explicit artifacts и готовность перепрокладывать carrier, когда исходный путь оказывался неверным.
