# Roadmap Matrix To A Full Working System

> Аналитический backlog-документ.  
> Это не SSOT на уровне требований; цель документа: свести [архитектуру](../architecture/system.md), [SSOT index](../ssot/index.md), [candidate backlog](./feature-candidates.md), ADR и фактический runtime к одному roadmap, который реально доводит систему до полноценной working system без stub-backed фикций.
> После миграции на `backlog-engineer` этот roadmap остаётся supporting input для backlog realignment и очередности работ, но не является текущим backlog state.

## 1. Краткий итог

### Что представляет собой система

Система в архитектуре описана как один долгоживущий identity-bearing агент с собственным runtime, PostgreSQL state kernel, Git-managed body, bounded HTTP boundary на `Hono`, тонким reasoning/model-integration слоем на `AI SDK` и вынесенными наружу model organs `vllm-fast`, `vllm-deep`, `vllm-pool`. Ключевой принцип: модели не являются субъектом; субъектом остаётся один агент, а модели являются заменяемыми органами. Это зафиксировано в [architecture/system.md](../architecture/system.md), repo ADR и delivered dossier chain `F-0001`…`F-0015`.

### В каком состоянии находится backlog

Backlog уже содержит сильный delivered backbone, но исторически смешивал два разных измерения:

- protocol-state backlog (`intaken`, `candidate`, `confirmed`);
- реальное delivery-state по досье `F-*`.

После предыдущего realignment backlog уже перестал врать про `CF-010` и теперь явно содержит `CF-023` как owner реального `vLLM` serving. В этом анализе owner map дополнительно закрыт четырьмя candidate seam: `CF-024` для operator auth/authz + RBAC, `CF-025` для deploy/release/rollback automation, `CF-026` для support/operability contract и `CF-027` для phase-6 governance completion. Без них roadmap всё ещё не замыкался бы на внешне безопасную и операционно полноценную систему.

### Главные архитектурные проблемы

- Главный разрыв первого класса: архитектура описывает реальную local model ecology, а delivered runtime до сих пор исторически пришёл к stub-backed `vllm-fast` и optional-only richer organs.
- `F-0014` закрывает registry/health/fallback seam, но не real serving seam; до `CF-023` система не имеет доказанного реального inference path.
- `F-0013` честно исключает public authN/authZ и stronger perimeter, поэтому delivered operator API не имеет собственного security owner-а.
- `F-0015` workshop завершает lifecycle/evidence seam, но не live activation/governance/release path; без соседних seams workshop не превращается в боевой model-improvement loop.
- `F-0012` homeostat delivered, но полнота его signal matrix зависит от будущих `CF-015`, `CF-016`, `CF-018`.

### Главные пробелы

- Реальный `vLLM` serving и promotion model dependencies: теперь backlog-owned как `CF-023`, но ещё не delivered.
- Operator auth/authz и roles/permissions: backlog-owned только после этого realignment как `CF-024`.
- Deploy/release/rollback automation: backlog-owned только после этого realignment как `CF-025`.
- Support/operability contract: после этого realignment backlog-owned как `CF-026`.
- Phase-6 governance completion для policy profiles, consultant admission и richer perception policies: после этого realignment backlog-owned как `CF-027`.

### Общая логика порядка реализации

Корректный порядок строится не по номеру `CF-*`, а по тому, что именно замыкает working system:

1. Сначала platform substrate, boot truth и smoke.
2. Затем fast-first реальный model-serving, иначе phase 0 остаётся архитектурно незакрытой.
3. Затем minimal living backbone: ticks, state, perception, router, decision, action, narrative, homeostat.
4. Затем control/operability closure: operator boundary, governor, lifecycle evidence, reporting, auth.
5. Затем richer model ecology и полный real serving beyond fast.
6. Затем skills, workshop, release automation, support contract.
7. Затем specialists, controlled body evolution и mature phase-6 governance closure.

## 2. План работы

| Этап | Что проверяется | Основные источники | Результат этапа |
|---|---|---|---|
| 1. Восстановление целостного понимания системы | Что именно является целевой системой, где проходят invariants и owner boundaries | [architecture/system.md](../architecture/system.md), [README.md](../../README.md), ADR, [ssot/index.md](../ssot/index.md) | Каноническая модель системы и список delivered/future-owned seams |
| 2. Нормализация backlog | Разделение protocol-state backlog и реального delivery-state | [feature-candidates.md](./feature-candidates.md), [ssot/index.md](../ssot/index.md), coverage map | Нормализованная карта статусов `Implemented / Partially implemented / Planned / Missing / Blocked / Needs clarification` |
| 3. Сопоставление с архитектурой и ADR | Где backlog совпадает с архитектурой, а где уходит в drift | [architecture/system.md](../architecture/system.md), ADR, relevant dossiers, runtime code | Матрица matches / mismatches / hidden dependencies |
| 4. Анализ зависимостей и порядка | В каком порядке seams реально должны строиться, чтобы не появлялись premature items | backlog, coverage map, ADR, runtime constraints | Ordered roadmap |
| 5. Проверка closure на full working system | Какие missing seams всё ещё мешают полноценной working system | Вся предыдущая аналитика + cross-cutting system aspects | Финальный roadmap и список обязательных additions |

## 3. Результаты по этапам

### Этап 1. Восстановление целостного понимания системы

**Мой анализ**

- Архитектура описывает не набор сервисов вокруг LLM, а одного субъекта с одной линией времени, одной биографией и вынесенными наружу model organs.
- `AI SDK` в этом репо не владеет памятью, жизненным циклом и HTTP surface; owner runtime остаётся у repo-owned `core`, HTTP boundary остаётся на `Hono`.
- Single-writer matrix и constitution-driven boot dependency set являются центральными invariants; любой roadmap, который их ломает, перестаёт вести к задуманной системе.
- Delivered backbone уже широк: `F-0001`…`F-0015` закрывают platform, boot, runtime, memory, perception, router, decision harness, executive, narrative, homeostat, operator API, richer registry/health и workshop evidence.
- Future-owned остаются governor, lifecycle evidence, reporting, specialists, body evolution, mature perimeter и ещё несколько implicit gaps, которые до этого анализа не были выделены как owner seams.

**Анализ субагента по тому же направлению**

- Независимый разбор подтвердил тот же образ системы: identity-bearing agent, вынесенные `vllm-*` organs, workshop как отдельный worker, PostgreSQL kernel и AI SDK только как thin reasoning layer.
- Субагент отдельно выделил архитектурную фазовую лестницу `phase 0 -> phase 6` и показал, что delivered SSOT закрывает backbone, но не operational closure.
- Отдельно был зафиксирован drift между real working system в архитектуре и историческим stub-backed runtime.

**Совпадения**

- Совпали модель системы как одного субъекта, а не ансамбля selves.
- Совпало понимание роли `AI SDK`, `Hono`, PostgreSQL, Git-body и external model organs.
- Совпал вывод, что delivered backbone силён, но не закрывает working system end-to-end.

**Расхождения**

- Существенных расхождений на этапе 1 не обнаружено.
- Субагент чуть сильнее акцентировал фазовую лестницу и delivered breadth; мой разбор сильнее акцентировал single-writer и boot invariants.

**Итог после сверки**

Финальной базой для roadmap принимается следующая картина: архитектура уже описывает рабочую реальную систему, delivered dossiers уже поставили большую часть скелета и живого ядра, а backlog должен рассматриваться не как список пожеланий, а как план эволюции от уже delivered backbone к operationally closed system.

### Этап 2. Нормализация и разбор backlog

**Мой анализ**

- `intaken` / `candidate` / `confirmed` в backlog не равны delivery-state; это прямо зафиксировано в самом backlog и coverage map.
- `CF-001`…`CF-011`, `CF-017`, `CF-020`, `CF-021`, `CF-022` фактически `Implemented`, потому что их canonical dossiers стоят `done` в [ssot/index.md](../ssot/index.md).
- `CF-012` и `CF-015` нельзя считать чисто future work: у них уже есть delivered precursor surfaces, поэтому это `Partially implemented`.
- `CF-013` остаётся `Needs clarification`: идея присутствует в архитектуре и backlog, но lifecycle boundary и adapter boundary ещё не shaped достаточно узко.
- `CF-023` теперь имеет backlog owner, но delivery нет; это `Planned`.
- В этом проходе backlog дополнительно realigned через четыре missing owner seam: `CF-024`, `CF-025`, `CF-026`, `CF-027`.

**Анализ субагента по тому же направлению**

- Субагент пришёл к почти той же нормализованной карте.
- Он отдельно подчеркнул, что backlog table визуально выглядит как live status dashboard, хотя по смыслу это planning protocol.
- Он подтвердил, что `CF-010` и `CF-020` стали согласованными с delivered code только после явного backlog realignment.

**Совпадения**

- Совпала базовая нормализация implemented foundation.
- Совпало понимание, что protocol-state и delivery-state ортогональны.
- Совпала оценка `CF-012` и `CF-015` как частично закрытых будущих seams.
- Совпала оценка `CF-023` как planned owner без delivery.

**Расхождения**

- По `CF-018` у меня была промежуточная гипотеза о partial precursor coverage из boot rollback/smoke lifecycle, у субагента итог был строже.

**Итог после сверки**

Финальное решение: `CF-018` в normalized roadmap трактуется как `Planned`, а не `Partially implemented`. Причина: delivered rollback and recovery evidence находятся в соседних features, но сам owner seam retention/compaction/graceful-shutdown biography ещё не поставлен.

### Этап 3. Сопоставление backlog с архитектурой и частными архитектурными решениями

**Мой анализ**

- Platform substrate, `AI SDK + Hono`, boot dependency contract и single-writer ownership хорошо совпадают между архитектурой, ADR и delivered code.
- `F-0013` корректно shaped как bounded operator boundary, а не как backdoor.
- `F-0012` корректно shaped как advisory guardrail seam, а не как direct control writer.
- Главный mismatch: архитектура phase 0 и phase 2 говорят о реальных `vllm-fast` / `vllm-pool` organs, а delivered runtime реально поднимает только `postgres`, `core` и stub-backed `vllm-fast`.
- `F-0014` закрывает source registry/health seam, но не real serving seam.
- `F-0013` вынес public auth/authz за scope, а backlog до этого анализа не имел отдельного owner seam на этот пробел; это закрыто только после добавления `CF-024`.
- `F-0002` фиксирует CI baseline, но explicit deploy/release automation owner отсутствовал.

**Анализ субагента по тому же направлению**

- Субагент подтвердил matches по platform substrate, write ownership, bounded operator routes и advisory homeostat.
- Он отдельно и жёстко подтвердил mismatch через фактический код: `compose` поднимает только `vllm-fast`, а `infra/docker/vllm-fast/server.py` является synthetic stub.
- Он явно зафиксировал hidden dependencies: real serving closure зависит от `CF-023`; workshop does not imply live improvement; `/models` depends on a chain of owners; homeostat depends on `CF-015/016/018`.
- Он также отдельно выделил, что security/perimeter отложены слишком далеко относительно уже delivered operator API.

**Совпадения**

- Совпал главный mismatch: architecture says real serving, delivered runtime still says stub.
- Совпало понимание роли `F-0014` как registry/health seam only.
- Совпало понимание `F-0013` и `F-0012` как честно bounded seams.
- Совпала оценка hidden dependencies вокруг workshop, homeostat и operator `/models`.

**Расхождения**

- Субагент сильнее подчеркнул hard code evidence по stub server и optional runtime services.
- Мой разбор сильнее акцентировал CD gap и необходимость explicit auth/RBAC owner-а.

**Итог после сверки**

Финальная архитектурная позиция такая:

- delivered backbone в основном консистентен с архитектурой;
- системный drift существует не в owner map как таковой, а в operational closure;
- этот drift закрывается только явными additional seams, а не переинтерпретацией уже delivered features.

Поэтому final roadmap обязан включать не только `CF-023`, но и dedicated closures для operator security boundary и release/deploy path.

### Этап 4. Анализ зависимостей и порядка имплементации

**Мой анализ**

- `CF-023` надо раскалывать на два ordered slice: fast-first для phase 0 closure и later deep/pool serving для phase 2 closure.
- `CF-009` delivered как bounded read/control API, но его security and governance closure зависят от `CF-016` и `CF-024`.
- `CF-011` как workshop evidence seam может жить раньше deploy automation, но operational live loop требует ещё `CF-023`, `CF-016` и `CF-025`.
- `CF-013` нельзя тянуть до стабилизации runtime/model ecology, иначе skills схлопнутся в prompt wrappers без жизненного цикла.
- `CF-019` нельзя считать implementation-ready до `CF-023`, `CF-011`, `CF-016` и `CF-025`.
- `CF-012` преждевременен без governor/evidence/baseline security, но после `CF-024` и control closure уже становится допустимым phase-5 seam.

**Анализ субагента по тому же направлению**

- Субагент предложил very similar order: platform substrate, fast-first `CF-023`, minimal living backbone, governor/reporting/lifecycle closure, richer ecology, deep/pool serving, operator closure, workshop, specialists, skills, body evolution, mature perimeter.
- Он отдельно настаивал, что `CF-023` fast-first slice должен идти намного раньше implicit old order.
- Он также предложил трактовать `CF-009` как two-step seam: read-only introspection early, full control closure later.
- Он отдельно пометил `CF-019` как blocked until real serving and governor exist.

**Совпадения**

- Совпал fast-first priority for `CF-023`.
- Совпало разделение minimal living backbone и later operational closure.
- Совпала необходимость не считать workshop и specialists implementation-ready слишком рано.
- Совпало понимание `CF-009` как partially closed seam in practice.

**Расхождения**

- Субагент не включал ещё четыре новых missing owner seam `CF-024`, `CF-025`, `CF-026`, `CF-027`, потому что они появились после его запуска.
- Между моим порядком и его draft есть лишь небольшое расхождение по относительному порядку `CF-015` и `CF-018`.

**Итог после сверки**

Финальный порядок принимает:

- fast-first `CF-023` рано, сразу после platform/boot truth;
- `CF-015` идёт после `CF-018`, чтобы reporting materialize-ился поверх canonical lifecycle evidence, а не из ad hoc proxy metrics;
- `CF-024` вставляется до claims about safe operator exposure;
- `CF-025` вставляется до claims about operationally closed live rollout and rollback;
- `CF-019` получает статус `Blocked`, а не просто `Planned`.

### Этап 5. Проверка полноты roadmap и достижимости полноценной working system

**Мой анализ**

- Minimal real local working system достижим после `CF-023 fast-first`, `CF-016`, `CF-018`, `CF-015` и уже delivered living backbone.
- Externally safe working system требует ещё `CF-024`, потому что иначе operator API остаётся trusted-local-only boundary.
- Operationally closed system требует ещё `CF-025`, потому что иначе release/deploy/rollback остаются ручным процессом.
- Полноценная mature system из архитектуры всё ещё требует явной closure-позиции по support/operability и phase-6 governance completion.

**Анализ субагента по тому же направлению**

- Субагент отдельно разделил minimal working system и full working system.
- Он подтвердил, что `CF-023 + CF-015 + CF-016 + CF-018` являются обязательным набором для минимально работоспособной реальной локальной системы.
- Он явно зафиксировал, что auth/authz, roles/permissions, deploy/release automation и support/operability contract всё ещё либо missing, либо unclear.

**Совпадения**

- Совпал набор обязательных seams для minimal real working system.
- Совпало понимание, что full working system требует дополнительных cross-cutting closures beyond current backlog.
- Совпало, что backlog после realignment уже может быть доведён до real system, но только если эти seams будут explicit.

**Расхождения**

- Субагент осторожно формулировал final verdict как “roadmap пока не достигает full working system”.
- Мой финальный вывод сильнее operationalized: после добавления `CF-024`, `CF-025`, `CF-026` и `CF-027` roadmap уже может вести к full working system, но последние два seam всё ещё требуют отдельного shaping, чтобы не расползтись по соседним governance/security owners.

**Итог после сверки**

Финальный verdict:

- backlog до этого анализа не доводил систему до full working system;
- после realignment он уже доводится до minimal real working system;
- до full working system roadmap доводится только вместе с explicit additions `CF-024`, `CF-025`, `CF-026`, `CF-027`.

## 4. Карта пробелов и противоречий

### Missing items

- `CF-024`: до этого анализа отсутствовал explicit owner for operator auth/authz + RBAC.
- `CF-025`: до этого анализа отсутствовал explicit owner for deploy/release/rollback automation.
- `CF-026`: до этого анализа support/operability contract не имел backlog owner-а.
- `CF-027`: до этого анализа policy profiles, consultant admission и richer perception policies не имели чёткого backlog owner-а.

### Hidden dependencies

- `CF-023` зависит не только от registry logic, но и от weights/artifacts policy, Docker or ROCm serving posture, constitution-driven dependency promotion и smoke proof over the canonical container path.
- `CF-011` сам по себе не делает models live; ему нужны `CF-023`, `CF-016` и practically `CF-025`.
- `CF-019` требует `CF-023`, `CF-011`, `CF-016`, `CF-025`; иначе specialist rollout не имеет real-serving и governance base.
- `CF-008` operationally неполон без `CF-015`, `CF-016`, `CF-018`.
- `CF-009` безопасен только вместе с `CF-024`.
- `CF-012` безопасен только после governor/evidence/baseline security closure.

### Conflicts

- Архитектура phase 0 и phase 2 говорят о real local model organs, а delivered runtime historically доказывает только stub-backed fast path.
- `F-0014` легко прочитать как real model ecology delivery, хотя он доставляет только richer registry/health/fallback source state.
- `F-0015` легко прочитать как live model improvement closure, хотя activation/approval и rollout лежат в соседних seams.
- `F-0013` уже delivered, но public authN/authZ и stronger perimeter intentionally out of scope.

### Premature items

- `CF-019` premature до реального serving, governor и release path.
- `CF-012` premature до control/evidence/security closure.
- `CF-013` premature до стабилизации runtime/model ecology boundary.
- Claims about full operator safety premature до `CF-024`.
- Claims about operational rollout maturity premature до `CF-025`.

### Critical technical gaps

- Нет delivered real inference over canonical `vLLM` path.
- Нет delivered auth/authz + RBAC owner for operator boundary.
- Нет delivered release/deploy/rollback owner.
- Нет explicit support/runbook/incident contract.
- Нет explicit owner for final phase-6 policy/admission/perception closure.

### Cross-cutting status snapshot

| Аспект | Статус | Комментарий |
|---|---|---|
| Auth/Authz | Missing | Теперь backlog-owned как `CF-024`, но delivery отсутствует |
| Roles and permissions | Missing | Должны войти в `CF-024`; сейчас explicit permission model нет |
| Configuration | Partially implemented | Baseline env/config delivered, mature policy config ещё future-owned |
| Observability | Partially implemented | Baseline health and homeostat exist, full reporting/metrics/tracing still future-owned |
| Logging / Audit | Partially implemented | `action_log`, boot evidence and homeostat snapshots delivered, unified reporting owner ещё не delivered |
| Error handling | Partially implemented | Fail-closed boot and bounded refusals delivered, operator-facing diagnostics incomplete |
| Data consistency | Partially implemented | Single-writer matrix strong, but governor/reporting/lifecycle closures still missing |
| Migrations | Implemented | Platform bootstrap and bounded schema compatibility are delivered |
| Security | Partially implemented | Baseline container posture exists, mature perimeter is future-owned |
| CI/CD | Partially implemented | CI delivered, CD/release automation now explicitly backlog-owned as `CF-025` |
| Deployment / rollback | Partially implemented | Local cell and boot rollback exist, full rollout orchestration is not delivered |
| Testing | Implemented | Root quality gate and deterministic smoke are delivered |
| Monitoring / alerting | Partially implemented | Homeostat exists, externalized monitoring/reporting closure still future-owned |
| Support / operability | Planned | Commands and introspection exist, and the explicit runbook/incident contract is now backlog-owned by `CF-026` |

## 5. Roadmap matrix

> Статусы в этой таблице нормализованы по фактическому состоянию реализации и readiness, а не по backlog protocol tokens.

| # | Initiative / Feature | Type | Status | Capability added | Architectural scope | Dependencies | Why now | What is blocked without it | Risks / Gaps |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `CF-020` Канонический scaffold монорепы и deployment cell | Feature | Implemented | Canonical container/runtime substrate, `seed` boundary, phase-0 service slot | Phase 0 platform | - | Без platform truth никакой дальнейший seam не имеет стабильной execution surface | Boot, runtime, model wiring, smoke path | Historical `vllm-fast` continuity remains stub-capable |
| 2 | `CF-021` Dependency/toolchain alignment | Feature | Implemented | Stable dependency and toolchain baseline | Cross-cutting platform | `CF-020` | Нужен, чтобы later seams не строились на drifting stack | Deterministic build/test/runtime parity | Must stay aligned with container path |
| 3 | `CF-022` Deterministic smoke harness | Feature | Implemented | Canonical containerized verification path | Platform verification | `CF-020`, `CF-021` | Working system claims must be smoke-proven | Runtime/deploy confidence | Real-model smoke still needs `CF-023` |
| 4 | `CF-001` Boot/recovery boundary | Feature | Implemented | Fail-closed startup, dependency checks, recovery gating | Phase 0 runtime | `CF-020` | Boot truth is the entry gate for all later runtime claims | Safe activation and continuity | Required dependency set still needs real-serving promotion |
| 5 | `CF-023` Fast-first real `vLLM` slice | Feature slice | Planned | Replace stubbed `vllm-fast` with real inference over canonical container path | Phase 0 real model-serving | `CF-020`, `CF-006`, `CF-001` | Architecture phase 0 already assumes one real organ | Any claim about real local-model runtime | Hardware, weights, probes and constitution update still unshaped |
| 6 | `CF-002` Tick runtime and episodic timeline | Feature | Implemented | Living time base, scheduler, episodes, one timeline | Phase 0 runtime | `CF-001`, `CF-020` | Turns scaffold into a living process | All higher cognition and jobs | Needs real model path for non-stub living system |
| 7 | `CF-003` Subject-state kernel | Feature | Implemented | Bounded identity/memory state | Phase 0 state kernel | `CF-001`, `CF-002` | Core subject continuity depends on it | Narrative, homeostat, operator state view | Downstream governance/reporting still incomplete |
| 8 | `CF-004` Perception buffer and adapters | Feature | Implemented | Canonical ingress and sensory normalization | Phase 0 perception | `CF-001`, `CF-002` | Required to feed the runtime | Action, cognition, timeline meaning | Richer policies/adapters still future-owned |
| 9 | `CF-006` Baseline router and organ profiles | Feature | Implemented | First organ/profile selection and bounded routing | Phase 0-1 model routing | `CF-002`, `CF-020` | Real-serving fast slice plugs into this seam | Deliberation/reflection profile continuity | Registry-only closure is insufficient without `CF-023` |
| 10 | `CF-017` Context builder and structured decision harness | Feature | Implemented | Canonical bounded cognition harness | Phase 0 cognition | `CF-002`, `CF-003`, `CF-004`, `CF-006` | Executive/action layer depends on structured decisions | Safe bounded decisions | Still consumes historical stubbed fast path unless `CF-023` lands |
| 11 | `CF-007` Executive center and bounded action layer | Feature | Implemented | Validated decisions, action wrappers, append-only audit | Phase 0 action boundary | `CF-002`, `CF-004`, `CF-006`, `CF-017`, `CF-020` | Completes minimal agent actuation | Meaningful runtime behavior | Must not become backdoor for state/governor |
| 12 | `CF-005` Narrative and memetic loop | Feature | Implemented | Internal competition, narrative spine, field journal | Phase 1 living cognition | `CF-002`, `CF-003`, `CF-004` | Required for living polyphony beyond reactive loop | Phase-1 mind model | Durable promotions/compaction remain future-owned |
| 13 | `CF-008` Homeostat and operational guardrails | Feature | Implemented | Advisory guardrails and reaction requests | Phase 1 safety | `CF-003`, `CF-005`, `CF-007` | Safety capability should appear early, not late | Controlled operation and future alerts | Full signal matrix still depends on `CF-015/016/018` |
| 14 | `CF-009` Operator API and introspection | Feature | Implemented | Bounded read API and limited control handoff | Operator surface | `CF-001`, `CF-002`, `CF-003`, `CF-004`, `CF-006` | Operators need bounded visibility early | Operability and debugging | Sensitive control remains unavailable until `CF-016`; safety needs `CF-024` |
| 15 | `CF-016` Minimal governor and policy gates | Feature | Planned | Freeze/proposal gates and canonical governance owner | Phase 1 control closure | `CF-003`, `CF-005`, `CF-008` | Needed before safe control claims and before later live model approval flows | Governor-backed operator control, workshop activation, homeostat completeness | Must stay owner-routed, not API-routed |
| 16 | `CF-018` Lifecycle evidence and graceful shutdown | Feature | Planned | Canonical rollback frequency, shutdown biography, retention/compaction owner | Runtime lifecycle | `CF-002`, `CF-003`, `CF-005`, `CF-007` | Reporting and homeostat should consume canonical lifecycle evidence | Safe rollback claims, consolidation discipline | No explicit partial owner exists yet |
| 17 | `CF-015` Observability and diagnostic reporting | Feature | Partially implemented | Canonical reports, metrics, tracing, inventory views | Operability and recovery | `CF-002`, `CF-003`, `CF-007`, `CF-010`, `CF-016`, `CF-018` | First-working system needs readable diagnostics, not only health endpoints | Homeostat `organ_error_rate`, model and snapshot reports, operator diagnostics | Baseline health exists, but full reporting seam is absent |
| 18 | `CF-024` Auth/Authz and operator RBAC | Feature | Planned | Public auth boundary, route permissions, fail-closed operator identity model | API security | `CF-020`, `CF-009` | Delivered operator API should not remain trusted-local-only forever | Safe operator exposure, route protection, human override separation | Must not become a second gateway or bypass owner seams |
| 19 | `CF-010` Expanded model ecology and registry health | Feature | Implemented | Richer registry, health, fallback, optional organ diagnostics | Phase 2 source-state ecology | `CF-006`, `CF-020` | Needed before richer serving and `/models` maturity | Stable richer diagnostics and fallback metadata | Does not provide actual serving |
| 20 | `CF-023` Deep/pool real-serving slice | Feature slice | Planned | Materialize real `vllm-deep` and `vllm-pool`, promote dependencies as needed | Phase 2 real model ecology | `CF-010`, `CF-023 fast-first` | Phase 2 architecture promises real local model ecology | Real embeddings/reranking/deeper organ usage | Optional-vs-required rule still needs shaping |
| 21 | `CF-013` Skills lifecycle boundary | Feature | Needs clarification | Versioned skill seeds, materialized skill tree, procedural lifecycle | Phase 2 skills | `CF-007`, `CF-020`, `CF-023` | Skill packaging makes sense only after runtime/model contracts stabilize | Reproducible procedural capability layer | Boundary with tools, workshop and AI SDK adapters still fuzzy |
| 22 | `CF-011` Workshop pipeline | Feature | Implemented | Datasets, training, eval, candidates, promotion-package | Phase 3 workshop | `CF-010` | Delivers durable improvement pipeline evidence | Model improvement lifecycle | Live activation still blocked by `CF-016`, `CF-023`, `CF-025` |
| 23 | `CF-025` Deploy/release automation and rollback orchestration | Feature | Planned | Environment promotion, release evidence, smoke-on-deploy, rollback automation | Operational deployment | `CF-020`, `CF-022`, `CF-023`, `CF-015`, `CF-016`, `CF-018` | Real serving and workshop outputs need an operational deployment path | Live rollout, safe deploys, non-manual rollback | No dossier yet; environment strategy still needs shaping |
| 24 | `CF-026` Support and operability contract | Feature | Planned | Runbooks, incident response, support ownership, operational procedures | Production operations | `CF-015`, `CF-024`, `CF-025` | Full working system needs supportability, not only code and APIs | Sustainable operation, incident handling, operator discipline | Must stay consumer of canonical evidence, not a shadow control layer |
| 25 | `CF-019` Specialist rollout and retirement | Feature | Blocked | Real specialist organs with staged rollout/retirement | Phase 4 specialization | `CF-010`, `CF-011`, `CF-016`, `CF-023`, `CF-025` | Only valid after real serving + workshop + governance | True specialization | Blocked by real-serving, governance and release gaps |
| 26 | `CF-012` Controlled body evolution | Feature | Partially implemented | Worktrees, code proposals, body evals, stable snapshot consumption | Phase 5 body evolution | `CF-001`, `CF-007`, `CF-011`, `CF-016`, `CF-024`, `CF-025` | Body mutation should come only after runtime and governance mature | Safe self-modification | Snapshot consumption exists; full evolution seam is not delivered |
| 27 | `CF-014` Mature security/perimeter hardening | Feature | Planned | Secrets policy, restricted shell hardening, stronger human gates | Phase 6 security | `CF-020`, `CF-007`, `CF-012`, `CF-016`, `CF-024` | Mature autonomy needs mature perimeter | Full security posture and human gates | Should not be the only owner of early auth/RBAC |
| 28 | `CF-027` Mature governance completion | Feature | Planned | Policy profiles, consultant admission, richer perception policies and remaining phase-6 maturity | Phase 6 governance | `CF-004`, `CF-006`, `CF-014`, `CF-015`, `CF-016`, `CF-024` | Architecture phase 6 still names capabilities that need a single owner seam | Final parity with intended mature architecture | Boundary with perimeter hardening and router policy still needs careful shaping |

## 6. Финальная проверка

### Какие элементы критичны для минимально работоспособной системы

- `CF-020`, `CF-021`, `CF-022`, `CF-001`, `CF-002`, `CF-003`, `CF-004`, `CF-006`, `CF-017`, `CF-007`.
- `CF-023 fast-first`, потому что без него runtime остаётся stub-backed.
- `CF-005`, `CF-008` для minimal living polyphony.
- `CF-016`, `CF-018`, `CF-015` для canonical control/evidence/reporting closure.

### Какие элементы критичны для полноценной рабочей системы

- Весь минимальный набор выше.
- `CF-024`, потому что без него operator boundary нельзя считать внешне безопасным.
- `CF-010` и `CF-023 deep/pool`, потому что architecture phase 2 обещает реальную local model ecology.
- `CF-011` и `CF-025`, потому что improvement loop без real deployment path остаётся полуручным.
- `CF-026`, потому что production-like system без support/operability contract остаётся неполной.
- `CF-019`, `CF-012`, `CF-014`, `CF-027`, если целью считается полная parity с phase-4/5/6 architecture.

### Какие элементы отсутствуют в backlog, но обязательны

- В этом анализе backlog дополнен `CF-024`, `CF-025`, `CF-026` и `CF-027`; до правки эти owner seams отсутствовали и были обязательными.
- На уровне backlog owner map явных missing seams больше не остаётся, но `CF-026` и `CF-027` всё ещё требуют shaping, чтобы не расползтись по соседним governance/security seams.

### Какие элементы стоят слишком рано и должны быть сдвинуты

- `CF-019` нельзя двигать раньше `CF-023 + CF-016 + CF-025`.
- `CF-012` нельзя двигать раньше governance/evidence/baseline security closure.
- `CF-013` нельзя тянуть раньше стабилизации runtime/model ecology boundary.
- Любые claims about safe operator exposure нельзя делать раньше `CF-024`.
- Любые claims about operational rollout maturity нельзя делать раньше `CF-025`.

### Приводит ли roadmap к полноценной рабочей системе

Да, но только в следующем виде:

- minimal real working system достигается после delivered backbone plus `CF-023 fast-first + CF-016 + CF-018 + CF-015`;
- externally safe and operationally closed system достигается после добавления `CF-024 + CF-025 + CF-026`;
- full architectural maturity достигается только если `CF-027` будет shape-нут и доведён вместе с остальными phase-6 seams.

Иными словами:

- прежний backlog не доводил систему до full working system;
- realigned backlog плюс этот roadmap уже доводят;
- последние оставшиеся blocker-ы теперь не скрыты, а явно названы.
