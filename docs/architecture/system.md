# Техническая архитектура агентной системы «Полифония»

## Детальная, реализуемая архитектура на основе актуальной концепции

> **Назначение документа:**
>
> Этот документ переводит актуальную концепцию «Полифонии» в инженерную плоскость. Он описывает не философскую идею, а **каноническую техническую архитектуру**, по которой команда может начать реализацию и двигаться от MVP к зрелой системе.

---

## 1. Обзор системы и ключевые принципы

### 1.1 Что строится

Строится **один долгоживущий агент**, который:

- живёт тиками;
- хранит identity-bearing state вне модели;
- мыслит через локальную модельную экологию;
- использует Mastra как когнитивный каркас, но не отдаёт ему власть над identity continuity;
- развивается через контролируемые контуры fine-tuning, специализированных моделей и Git-governed code evolution.

### 1.2 Ключевое архитектурное решение

**Полифония не должна быть «чисто Mastra-проектом» и не должна быть «чисто LLM server orchestration».**

Правильное разбиение такое:

- **Mastra** отвечает за agent-level reasoning, tools, skills, server API и bounded workflows.
- **Polyphony Runtime** отвечает за всё, что является концептуальным инвариантом:
  - тики;
  - PSM;
  - memetic field;
  - narrative continuity;
  - development governor;
  - homeostasis;
  - identity-bearing memory.
- **Local model services** отвечают за вычислительные органы, но не за личность.
- **Workshop** отвечает за тренировку, оценку и выпуск моделей/адаптеров.
- **Git governance** отвечает за дисциплину изменений тела.

### 1.3 Стандарт качества

Перед началом проектирования фиксируем стандарт качества, по которому оценивается вся архитектура.

#### Полнота

Архитектура должна покрывать:

- temporal core;
- PSM;
- memory stack;
- memetic field;
- narrative continuity;
- model ecology;
- fine-tuning и выпуск специализированных моделей;
- Git-governed code evolution;
- safety/isolation;
- phased implementation plan.

#### Реализуемость

Для каждого критического компонента должны быть указаны:

- процессная граница или модульная граница;
- конкретные технологии;
- интерфейсы;
- формат данных;
- путь к incremental implementation.

#### Согласованность

Компоненты не должны противоречить ключевым принципам концепции, особенно:

- не должно появляться второго субъекта;
- личность не должна жить внутри модели;
- фоновые процессы не должны иметь права на самостоятельную волю;
- саморазвитие не должно обходить governor.

#### Обоснованность

Ключевые решения сопровождаются объяснением, почему выбран именно этот подход, а не ближайшая альтернатива.

#### Масштабируемость

Архитектура должна иметь понятную лестницу роста:

- от локального MVP;
- к локальной автономной системе;
- к системе с model workshop;
- к системе с controlled body evolution.

### 1.4 Краткая формула архитектуры

```text
Один identity-bearing core.
Несколько не-личностных органов.
Одна общая память.
Одна линия времени.
Один исполнитель.
Развитие только через gate.
```

---

## 2. Архитектурная позиция

### 2.1 Что является источником истины

В системе есть три главных источника истины, и их нельзя смешивать.

1. **PostgreSQL state kernel** — источник истины для PSM, timeline, episodes, goals, beliefs, memetic field state, model registry, development ledger.
2. **Git-managed body** — источник истины для кода и исполнимых навыков.
3. **Constitutional shell** — источник истины для предельных ограничений, resource budgets и recovery policy.

### 2.2 Что не является источником истины

- конкретная LLM;
- prompt history сама по себе;
- raw logs;
- один markdown-summary;
- состояние какого-либо локального model server.

### 2.3 Почему personality state нельзя держать в Mastra memory как в единственном хранилище

Mastra memory полезна как вспомогательный слой для thread-oriented interaction и bounded context retention, но **не должна** быть источником истины для identity-bearing памяти Полифонии.

Причины:

- концепции требуется собственная temporal ontology;
- требуется собственный memetic field state;
- требуется собственный governor/homeostat loop;
- требуется строгий контроль над тем, что происходит между тиками;
- необходимо жёсткое разделение между биографией, developmental memory и procedural interaction memory.

### 2.4 Почему не использовать Mastra Observational Memory как ядро личности

Mastra Observational Memory концептуально полезна, но в текущей концепции она не должна быть identity core memory, потому что использует отдельные background agents для Observer/Reflector-процессов, а Полифония запрещает появление второго субъекта на фоне.

Решение:

- **не использовать OM как core self-memory**;
- при желании использовать обычную message history / working memory только для узких thread-local UI use-cases;
- всё identity-bearing и development-bearing хранить в Polyphony State Kernel.

### 2.5 Почему PostgreSQL, а не SQLite, как каноническая база

Для MVP SQLite/libSQL возможна. Но как каноническая архитектура выбирается **PostgreSQL**, потому что она лучше подходит для:

- конкурентных фоновых workers;
- job queue;
- JSONB-документов;
- сложных индексов;
- lease-based execution;
- future-proof growth.

### 2.6 Почему один identity-bearing core, а не сеть субагентов

Потому что концепция требует:

- одного субъекта;
- одного action channel;
- одной биографии;
- одного центра интеграции.

Поэтому любые параллельные процессы в системе — это либо органы, либо физиология, либо воркеры, но не новые личности.

---

## 3. Обзор системы

### 3.1 Канонический deployment layout

Канонический runtime разворачивается как **одна deployment cell** с несколькими сервисами.

```mermaid
flowchart LR
    subgraph cell[Polyphony Deployment Cell]
        subgraph control[Identity-bearing Control Plane]
            boot[Constitutional Shell / Boot]
            core[Polyphony Core Runtime\nTypeScript + Mastra]
            jobs[Physiology Scheduler / Job Workers]
        end

        subgraph organs[Cognitive Organs]
            fast[vLLM Fast Generative]
            deep[vLLM Deliberation / Code]
            pool[vLLM Pooling\nEmbeddings / Rerank / Classify]
            workshop[Model Workshop\nPython Training Worker]
        end

        subgraph state[State & Body]
            pg[(PostgreSQL)]
            repo[/Git-managed Workspace/]
            artifacts[/Models · Datasets · Snapshots/]
        end

        ingress[Ingress adapters\nHTTP / Files / Bots / System] --> core
        core <--> pg
        jobs <--> pg
        core <--> fast
        core <--> deep
        core <--> pool
        jobs <--> workshop
        workshop <--> pg
        workshop <--> artifacts
        core <--> repo
        workshop <--> repo
        core <--> artifacts
        core --> egress[Bounded Tools / Action Layer]
        boot --> core
        boot --> jobs
    end
```

### 3.2 Обязательные сервисы и процессы

#### A. `polyphony-core`

Главный identity-bearing процесс.

Содержит:

- tick engine;
- context builder;
- PSM manager;
- memetic field engine;
- narrative manager;
- executive center;
- model router;
- tool gateway;
- API server;
- часть pg-boss workers.

#### B. `postgres`

Главное state storage и durable queue backend.

Хранит:

- timeline;
- episodes;
- PSM;
- beliefs/goals/entities;
- memetic state;
- model registry;
- training jobs;
- code change proposals;
- evaluation results.

#### C. `vllm-fast`

Быстрый generative organ для:

- reactive ticks;
- summarization;
- low-cost drafts;
- fast route preselection.

#### D. `vllm-deep`

Более медленный generative/code organ для:

- deliberative ticks;
- contemplative ticks;
- code reasoning;
- review drafts;
- reflective synthesis.

#### E. `vllm-pool`

Pooling organ для:

- embeddings;
- reranking;
- classification/score tasks;
- dense retrieval prep.

#### F. `polyphony-workshop`

Отдельный training/evaluation worker.

Используется для:

- dataset construction;
- LoRA/QLoRA training;
- small specialist model training;
- regression eval;
- artifact packaging.

### 3.3 Что хранится в core, а что выносится наружу

| Что | Где живёт | Почему |
|---|---|---|
| Личность, PSM, narrative, memetic field | `polyphony-core` + PostgreSQL | identity-bearing state должен быть централизован |
| LLM inference | vLLM services | отдельные органы проще масштабировать и обновлять |
| Fine-tuning / model training | `polyphony-workshop` | тяжёлые вычисления не должны блокировать core |
| Код, навыки и bootstrap manifests | read-only `seed` volume + materialized runtime volumes | tracked initialization content must stay separate from generated mutable state |
| Background queue | PostgreSQL + pg-boss | не нужен отдельный брокер для первой зрелой версии |

### 3.4 Основной инженерный тезис

**Личность живёт только в `polyphony-core` + state kernel.**

Ни один model server, training worker, skill script или Git worktree не является носителем личности.

---

## 4. Компонентная архитектура

### 4.1 Логическая схема внутри `polyphony-core`

```mermaid
flowchart TD
    ingress[Ingress API / Sensor adapters] --> intake[Stimulus Intake]
    intake --> tick[Tik Engine]
    tick --> context[Context Builder]
    context --> memory[State Kernel Access]
    context --> memetics[Memetic Arena]
    context --> router[Model Router]
    router --> agent[Mastra Decision Agent]
    memetics --> agent
    memory --> agent
    agent --> decision[Structured Decision]
    decision --> exec[Executive Center]
    exec --> tools[Tool Gateway]
    tools --> world[External Effects]
    world --> episodes[Episode Encoder]
    episodes --> memory
    decision --> narrative[Narrative Manager]
    decision --> homeostat[Homeostat]
    decision --> governor[Development Governor]
    governor --> jobs[Background Jobs API]
    jobs --> memory
```

### 4.2 Модули `polyphony-core`

#### 4.2.1 Constitutional Boot Layer

Обязанности:

- загрузка `constitution.yaml`;
- проверка schema version;
- проверка целостности volumes;
- health-check зависимостей;
- выбор режима старта: normal / degraded / recovery;
- fallback to stable snapshot;
- публикация boot event в timeline.

Почему отдельным слоем:

- запуск и откат не должны зависеть от mutable runtime-состояния агента;
- ограничения должны быть доступны раньше, чем начнётся жизнь тиков.

#### 4.2.2 Tick Engine

Обязанности:

- создание субъективных тиков;
- нормализация trigger-источников;
- определение tick kind;
- запуск stateful loop;
- защита от overlapping ticks.

Tick kinds:

- `reactive`;
- `deliberative`;
- `contemplative`;
- `consolidation`;
- `developmental`;
- `wake`.

#### 4.2.3 Context Builder

Собирает вход для текущего тика из:

- stimulus envelope;
- recent episodes;
- active goals;
- relevant beliefs;
- narrative current chapter;
- field journal excerpts;
- active memetic units;
- available organs/skills;
- resource posture.

Практически `Context Builder` должен опираться на унифицированный слой сенсорных адаптеров и буфер восприятия.

Базовый контракт адаптера:

```ts
type SensorSource = 'http' | 'file' | 'telegram' | 'scheduler' | 'resource' | 'system';

type SensorSignal = {
  id: string;
  source: SensorSource;
  occurredAt: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  threadId?: string;
  entityRefs?: readonly string[];
  requiresImmediateTick: boolean;
  payload: Record<string, unknown>;
};

interface SensorAdapter {
  readonly id: string;
  readonly source: SensorSource;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  poll?: () => Promise<readonly SensorSignal[]>;
  onSignal?: (handler: (signal: SensorSignal) => void) => void;
  health: () => Promise<{ ok: boolean; detail?: string }>;
}
```

Минимальный обязательный набор адаптеров первой delivered версии:

- `http-ingress-adapter` — принимает внешние стимулы через Mastra/custom HTTP routes;
- `filesystem-adapter` — отслеживает allowlisted директории через `chokidar`;
- `scheduler-adapter` — переводит существующие runtime/scheduler hooks в сенсорные сигналы; в phase-0 это lifecycle/activation hooks планировщика, а не синтетический heartbeat loop, с последующим расширением до событий `pg-boss`;
- `resource-adapter` — публикует сигналы давления CPU/RAM/GPU/диска;
- `telegram-adapter` — принимает allowlisted operator stimuli через Telegram Bot API;
- `system-adapter` — boot/recovery/freeze/promote/rollback сигналы самого организма.

Первая delivered реализация `telegram-adapter` использует long polling, а не webhook ingress, и активируется только при явном config enable + secret contract, чтобы не требовать отдельный публичный callback endpoint в локальной deployment cell.

Сигналы не подаются прямо в decision loop. Они сначала попадают в **perception buffer** фиксированного размера, где выполняются:

- дедупликация;
- подавление шума;
- приоритизация;
- склейка burst-событий;
- вычисление агрегатов `urgency`, `novelty`, `resourcePressure`.

Именно результат этого слоя, а не сырой event stream, становится материалом для текущего тика.

#### 4.2.4 Memetic Arena

Отвечает за:

- активацию memetic units;
- reinforcement/decay;
- coalition formation;
- suppression/support scoring;
- quarantine паразитических паттернов;
- handoff winning coalition в PSM/Decision Agent.

##### Memetic Lifecycle

Меметический слой состоит из **двух разных сущностей**, и их нельзя смешивать:

- **memetic candidate** — tick-local pattern, собранный внутри текущего тика из текущего контекста; сам по себе не является durable state;
- **memetic unit** — durable abstracted pattern, сохранённый в `memetic_units` и способный возвращаться в будущие тики.

Канонический lifecycle должен работать так:

1. **Bootstrap before first tick:** до первого `wake` тика runtime materialize-ит минимальный baseline set из constitution, identity core и initial goals/beliefs. Первый тик не может зависеть от "прошлого цикла", которого ещё не было.
2. **Candidate assembly inside tick:** `Memetic Arena` строит candidate set из current stimulus, retrieved episodes, active goals/beliefs, narrative tensions, field journal excerpts, active durable units и resource posture.
3. **Tick-local competition:** candidates и existing units вместе участвуют в activation, suppression/support scoring и coalition formation; победившая coalition only influences attention, organ selection и final decision path.
4. **No raw-ingest-to-durable rule:** raw `stimulus_inbox.normalized_json`, пользовательские сообщения и любые single-shot payloads не могут verbatim становиться `memetic_units`. Сначала они должны пройти через tick, episode encoding и evidence linking.
5. **Tick write boundary:** обычный tick может обновлять activation/reinforcement/decay у existing units, создавать `coalitions` rows и добавлять anchors/evidence к уже существующим patterns, но не должен сам по себе silently промоутить разовый stimulus в durable meme.
6. **Promotion boundary:** новые durable `memetic_units` могут появляться только тремя путями: bootstrap seeding, consolidation из повторяющихся patterns, либо explicit governor/operator labeling. Creation always requires abstracted content, provenance anchors и evidence beyond one isolated stimulus.
7. **Consolidation ownership:** именно `consolidation` tick является owner-ом promotion, merge, split, decay, quarantine и retire semantics для durable memetic state; это не должно происходить ad hoc в reactive path.
8. **Narrative boundary:** one-off unresolved tensions и незрелые patterns должны жить в `field_journal_entries` / narrative, пока не появится достаточное повторяющееся evidence для durable promotion.
9. **Provenance invariant:** каждый durable unit обязан иметь traceable anchors к episodes, goals, beliefs, entities, narrative tensions или model organs; anchorless units запрещены.

#### 4.2.5 PSM Manager

Отвечает за:

- identity core updates;
- affect updates;
- goal transitions;
- belief revisions;
- subjective snapshot assembly;
- continuity checks.

#### 4.2.6 Narrative Manager

Отвечает за:

- narrative spine updates;
- field journal maintenance;
- distinction between facts / interpretations / direction;
- narrative compaction;
- linkage between episodes and narrative revisions.

#### 4.2.7 Model Router

Выбирает:

- какой organ использовать;
- какой adapter/profile активировать;
- нужен ли rerank/classify/reflect pass;
- допустим ли внешний consultant.

Критерии выбора:

- tick mode;
- latency budget;
- context size;
- risk level;
- task kind;
- organ health;
- recent evaluation score.

#### 4.2.8 Mastra Decision Agent

Это один Mastra `Agent`, который работает как **bounded cognitive harness**.

Он не хранит личность, а решает текущий тик на основе уже подготовленного контекста.

Он должен возвращать **строго структурированное решение**, а не свободный текст.

#### 4.2.9 Executive Center

Принимает финальное действие. Только этот модуль имеет право:

- утверждать tool invocation;
- ставить job;
- инициировать review request;
- подтверждать осознанное бездействие.

#### 4.2.10 Tool Gateway

Оборачивает все tools в единый безопасный слой.

Только Tool Gateway имеет право:

- ходить в разрешённые volumes;
- вызывать Git wrappers;
- ставить background jobs;
- отправлять bounded HTTP requests;
- запускать restricted shell commands.

#### 4.2.11 Homeostat

Следит за:

- oscillation risk;
- over-dominant coalitions;
- mode hysteresis;
- excessive development churn;
- affect bounds;
- continuity risk.

#### 4.2.12 Development Governor

Обрабатывает:

- improvement hypotheses;
- model adaptation proposals;
- specialized model birth proposals;
- code change proposals;
- rollout/rollback policies;
- freeze conditions.

### 4.3 Почему core должен быть монолитом, а не микросервисным роем

Для identity-bearing части архитектуры выигрывает **модульный монолит**, а не микросервисы.

Причины:

- концептуальная простота;
- отсутствие сетевых границ внутри самости;
- более понятные транзакции на тик;
- меньше риска race conditions вокруг identity state;
- проще отлаживать continuity.

Микросервисность уместна только для не-личностных органов:

- model servers;
- workshop;
- storage.

---

## 5. Технологический стек

### 5.1 Канонический стек

#### Identity-bearing runtime

- **Node.js 22 LTS**
- **TypeScript 5.x**
- **Mastra** для agent/tools/skills/server/workflows
- **Zod** для контрактов входа/выхода и structured decisions
- **node:test** для smoke и invariant tests

#### State kernel

- **PostgreSQL 17+**
- `JSONB` как основной формат гибких state-документов
- `pgvector` опционально для семантического поиска и retrieval-экспериментов

#### Background jobs

- **pg-boss** поверх PostgreSQL

#### Model serving

- **vLLM** для generative и pooling organs
- OpenAI-compatible server interface
- LoRA adapters для органично загружаемых специализаций

#### Workshop / training

- **Python 3.12**
- **transformers**
- **datasets**
- **TRL SFTTrainer**
- **PEFT / LoRA / QLoRA**
- **sentence-transformers** для retriever/reranker задач
- **ONNX Runtime** для экспорта лёгких inference-моделей при необходимости

#### Body governance

- **Git**
- `git worktree`
- `githooks`
- stable tags / snapshots

#### Containerization

- **Docker Engine + Compose**
- rootless или максимально приближённая к rootless конфигурация
- read-only root filesystem там, где возможно
- dedicated volumes
- `tmpfs` для временных путей

### 5.2 Почему именно такой стек

- TypeScript + Mastra соответствуют исходной рамке и ускоряют построение bounded agent logic.
- PostgreSQL закрывает одновременно state, jobs и сложные запросы.
- vLLM даёт один унифицированный стек для generative и pooling tasks.
- TRL + PEFT дают практичный путь к supervised specialization без полного retraining.
- Git естественно решает задачу versioned body evolution.

### 5.3 Что сознательно не берётся в каноническую версию

- отдельный Kafka / RabbitMQ broker;
- отдельная vector DB как обязательный компонент;
- Kubernetes как обязательная среда;
- event sourcing всего подряд;
- multi-agent orchestration как core design;
- бесконтрольный shell.

---

## 6. Структура репозитория

Рекомендуемая монорепо-структура:

```text
polyphony/
  apps/
    core/
      src/
        boot/
        api/
        runtime/
        memory/
        memetics/
        psm/
        narrative/
        governor/
        homeostat/
        model-router/
        tools/
        git/
        jobs/
        mastra/
    workshop/
      src/
        datasets/
        train/
        eval/
        export/
        promote/
  packages/
    domain/
    contracts/
    db/
    evals/
    skills/
    testkits/
  seed/
    body/
    skills/
    constitution/
    models/
    data/
  workspace/
    body/
    skills/
    journals/
  models/
    base/
    adapters/
    specialists/
  data/
    datasets/
    snapshots/
    reports/
  infra/
    docker/
    migrations/
    scripts/
```

### 6.1 Почему monorepo

Monorepo лучше подходит, потому что:

- core, workshop и shared contracts тесно связаны;
- schema/version drift проще контролировать;
- Git-governed body evolution становится проще;
- легче проводить cross-component rollback.

---

## 7. Модель данных и хранения

### 7.1 Общая стратегия хранения

Система использует три класса хранилищ.

| Класс | Технология | Что хранится |
|---|---|---|
| Транзакционное состояние | PostgreSQL | identity-bearing state, timeline, jobs, registries |
| Версионное тело | Git workspace + tags | код, навыки, схемы, scripts |
| Артефакты | volumes / object-like filesystem | модели, адаптеры, датасеты, eval reports, snapshots |

### 7.2 Основные таблицы PostgreSQL

#### `agent_state`

Singleton-таблица.

Содержит:

- `agent_id`
- `current_tick`
- `mode`
- `psm_json`
- `resource_posture_json`
- `current_model_profile_id`
- `last_stable_snapshot_id`
- `updated_at`

#### `ticks`

Содержит:

- `tick_id`
- `tick_kind`
- `trigger_kind`
- `started_at`
- `ended_at`
- `status`
- `selected_coalition_id`
- `selected_model_profile_id`
- `action_id`
- `continuity_flags_json`

#### `episodes`

Содержит:

- `episode_id`
- `tick_id`
- `summary`
- `importance`
- `valence`
- `participants_json`
- `result_json`
- `internal_tension_json`
- `evidence_refs_json`
- `created_at`

#### `entities`

Содержит:

- `entity_id`
- `entity_kind`
- `canonical_name`
- `state_json`
- `trust_json`
- `last_seen_at`
- `updated_at`

#### `relationships`

Содержит:

- `src_entity_id`
- `dst_entity_id`
- `relation_kind`
- `confidence`
- `updated_at`

#### `goals`

Содержит:

- `goal_id`
- `title`
- `status`
- `priority`
- `goal_type`
- `parent_goal_id`
- `rationale_json`
- `evidence_refs_json`
- `updated_at`

#### `beliefs`

Содержит:

- `belief_id`
- `topic`
- `proposition`
- `confidence`
- `status`
- `evidence_refs_json`
- `updated_at`

#### `memetic_units`

Содержит:

- `unit_id`
- `origin_kind` (`seeded`, `consolidated`, `governor_labeled`)
- `unit_type`
- `content`
- `activation`
- `valence`
- `stability`
- `plasticity`
- `evidence_score`
- `anchors_json`
- `status` (`active`, `dormant`, `quarantined`, `retired`, `merged`)
- `updated_at`

#### `memetic_edges`

Содержит:

- `src_unit_id`
- `dst_unit_id`
- `relation_kind` (`supports`, `suppresses`, `contextualizes`, `contradicts`)
- `weight`

#### `coalitions`

Содержит:

- `coalition_id`
- `tick_id`
- `vector`
- `strength`
- `explanation_md`
- `member_ids_json`
- `won`

#### `narrative_spine_versions`

Содержит:

- `version_id`
- `anchors_md`
- `facts_md`
- `current_chapter_md`
- `tensions_md`
- `direction_md`
- `source_episode_ids_json`
- `created_at`

#### `field_journal_entries`

Содержит:

- `entry_id`
- `tick_id`
- `entry_kind`
- `content_md`
- `ttl`
- `created_at`

#### `development_ledger`

Содержит:

- `entry_id`
- `entry_kind` (`model_train`, `model_promote`, `model_rollback`, `code_proposal`, `code_promote`, `code_rollback`, `policy_change`)
- `subject_ref`
- `summary`
- `evidence_json`
- `rollback_ref`
- `created_at`

#### `model_registry`

Содержит:

- `model_profile_id`
- `role` (`reflex`, `deliberation`, `reflection`, `code`, `embedding`, `reranker`, `classifier`, `safety`)
- `provider` (`vllm`, `onnxruntime`, `python-worker`)
- `endpoint`
- `artifact_uri`
- `base_model`
- `adapter_of`
- `capabilities_json`
- `cost_json`
- `health_json`
- `status`

#### `datasets`

Содержит:

- `dataset_id`
- `dataset_kind`
- `source_manifest_json`
- `source_episode_ids_json`
- `split_manifest_json`
- `status`
- `created_at`

#### `training_runs`

Содержит:

- `run_id`
- `target_kind`
- `target_profile_id`
- `dataset_id`
- `method`
- `hyperparams_json`
- `metrics_json`
- `artifact_uri`
- `status`
- `started_at`
- `ended_at`

#### `eval_runs`

Содержит:

- `eval_run_id`
- `subject_kind`
- `subject_ref`
- `suite_name`
- `metrics_json`
- `pass`
- `report_uri`
- `created_at`

#### `code_change_proposals`

Содержит:

- `proposal_id`
- `problem_signature`
- `rationale_md`
- `scope_kind`
- `branch_name`
- `worktree_path`
- `candidate_commit_sha`
- `required_eval_suite`
- `status`
- `created_at`

#### `stable_snapshots`

Содержит:

- `snapshot_id`
- `git_tag`
- `model_profile_map_json`
- `schema_version`
- `health_summary_json`
- `created_at`

#### `stimulus_inbox`

Содержит:

- `stimulus_id`
- `source_kind`
- `thread_id`
- `occurred_at`
- `priority`
- `priority_rank`
- `requires_immediate_tick`
- `payload_json`
- `normalized_json`
- `dedupe_key`
- `claim_tick_id`
- `status`
- `created_at`
- `updated_at`

Это canonical durable intake table. Минимальный query contract для perception layer опирается на queue ordering, dedupe и restart-safe claim recovery поверх этих полей.

#### `jobs`

Техническая таблица `pg-boss` + дополнительные domain job tables, если нужно.


#### `homeostat_snapshots`

Содержит:

- `snapshot_id`
- `tick_id`
- `overall_stability`
- `affect_volatility`
- `goal_churn`
- `coalition_dominance`
- `resource_pressure`
- `development_freeze`
- `alerts_json`
- `created_at`

#### `action_log`

Append-only журнал выполненных действий и опасных попыток.

Содержит:

- `action_id`
- `tick_id`
- `action_kind`
- `tool_name`
- `parameters_json`
- `boundary_check_json`
- `result_json`
- `success`
- `created_at`

Практическое правило: runtime-пользователь агента **не должен иметь прав на `UPDATE`/`DELETE` для `action_log`**. Это важный источник послетикового аудита и recovery-разбора.

### 7.2.1 Identity-bearing write authority

Identity-bearing surfaces допускают чтение из нескольких seams, но канонический writer у каждой такой surface только один. Любая попытка helper-worker, runtime convenience layer или позднего feature seam писать в такую surface в обход canonical owner считается архитектурным дефектом, а не "временной интеграцией".

| Surface | Canonical writer | Allowed callers | Forbidden writers | Notes on transaction boundary |
|---|---|---|---|---|
| Boot/recovery continuity fields (`agent_state.mode`, `last_stable_snapshot_id`, recovery incidents, stable-snapshot rollback refs) | Constitutional boot/recovery boundary (`F-0001`) | `F-0002` platform bootstrap supplies constitution/health substrate; `F-0003` reads the post-activation state; `F-0004` and `F-0008` consume resulting pointers read-only | Tick runtime outside boot handoff, `SubjectStateStore`, router, executive/tool workers, reporting jobs | Written only during preflight/recovery activation before new tick admission starts. Later seams may read this boundary but may not back-write it. |
| Active tick / continuity bridge (`ticks` lifecycle rows, `agent_state.current_tick`, active-tick continuity metadata) | Tick runtime lifecycle (`F-0003`) | `F-0001` activates runtime; `F-0008` may attach selected-profile metadata through the same continuity transaction; `F-0004` may commit completed-tick state deltas only through the completed terminal path | Boot/recovery after activation, router acting alone, executive/tool workers, reporting/homeostat jobs | Admission, lifecycle ordering and terminal cleanup belong to one active-tick transaction. Neighbouring seams may attach their own metadata only through that boundary, not via side writes. |
| Subject-state singleton and normalized tables (`psm_json`, `goals`, `beliefs`, `entities`, `relationships`) | `SubjectStateStore` (`F-0004`) | `F-0003` completed-tick path invokes the store; future cognitive seams consume bounded snapshots and submit deltas through canonical store contracts | Boot/recovery logic, router, executive/tool gateway, reporting/homeostat workers, direct SQL from future seams | Writes are valid only through the canonical store contract and only on the allowed completed-tick commit path or explicit schema migration/backfill owned by the same seam. |
| Model-profile continuity surfaces (`model_registry`, `ticks.selected_model_profile_id`, `agent_state.current_model_profile_id`) | Baseline model-routing seam (`F-0008`) via the `F-0003` continuity transaction | Runtime and future decision harness request selection; platform health surface reads diagnostics; boot/recovery reads the active profile pointer during restart/reclaim | Boot/preflight changing profile selection, `SubjectStateStore`, executive/governor/reporting workers writing profile choices directly | Profile registration is router-owned; active profile pointers become durable only when committed through the runtime continuity boundary. |
| Future narrative and memetic surfaces (`memetic_units`, `memetic_edges`, `coalitions`, `narrative_spine_versions`, `field_journal_entries`) | Future cognition/consolidation seams (`CF-005` with `CF-018` for allowed durable transitions) | Tick runtime may pass bounded candidates; context builder and reporting may consume read models | Boot/runtime/router/executive writing durable narrative or memetic state directly | Durable transitions must use explicit promotion/compaction paths. No other seam receives generic write authority over these surfaces. |
| Development/governance proposal surfaces (`development_ledger`, model/code/policy proposals) | Future governor/workshop/code-evolution seams (`CF-016`, `CF-011`, `CF-012`) | Runtime, recovery, workshop and human override may submit evidence or incidents through governor-owned gates | Boot/runtime/router/subject-state seams writing arbitrary proposal rows directly | Proposal and ledger writes must flow through policy gates and preserve evidence plus rollback links. |
| Read-only reporting surfaces (identity continuity reports, model health reports, stable-snapshot inventories) | Derived observability/reporting seam (`CF-015`) | All canonical writers above provide source state; homeostat and human audit consume reports | Reporting workers back-writing identity-bearing source tables | Reports are materialized from committed source state and may not mutate the business or identity-bearing surfaces they summarize. |

### 7.2.2 Non-identity workers

- Health/readiness checks, reporting jobs, context assembly, model diagnostics and other helper workers may read identity-bearing state only through canonical contracts.
- Такие workers не получают generic write authority только потому, что работают "внутри core" или "в рамках того же тика"; helper execution context не меняет ownership matrix.
- Нарушение этой matrix считается architecture defect и должно устраняться через realignment canonical owner-а, а не нормализоваться как удобный shortcut.

### 7.2.3 Subject State Schema and Evolution

`F-0004` остаётся owner-ом full subject-state snapshot contract, но repo-level compatibility rules должны быть явными и не восстанавливаться по нескольким delivered dossiers.

Canonical principles:

- `psm_json` хранит только bounded singleton self-model data, которая принадлежит одному субъектному anchor и не требует собственного row-identity или реляционных query patterns.
- `goals`, `beliefs`, `entities` и `relationships` обязаны жить в нормализованных таблицах, потому что у них есть собственная identity, evidence lineage, ordering/filtering semantics и частичные mutation paths.
- Narrative/memetic history, timeline/episodes, action logs, reporting payloads, model registries и governance/development proposals не принадлежат `psm_json` и не должны прятаться туда как "временный JSON".
- Continuity pointers (`current_tick`, `current_model_profile_id`, snapshot refs) могут жить рядом с subject-state anchor, но не считаются заменой versioned subject-state contract.

Architecture-level invariant:

- Каждый bounded subject-state snapshot обязан нести `subject_state_schema_version`. Физическое хранение может переиспользовать существующее schema metadata field, но compatibility contract выражается именно как versioned subject-state surface, а не как implicit JSON shape.

Compatibility rules:

- Supported version: boot/recovery и runtime consumers могут загружать snapshot без дополнительных миграций.
- Unsupported version: `F-0001` обязан fail-closed или войти в recovery policy before active runtime handoff; `F-0003` и другие consumers не имеют права silently coercе-ить snapshot в "примерно подходящую" форму.
- Migration/backfill для subject-state schema принадлежат `F-0004` и его явным follow-on realignments. Boot/runtime/reporting seams могут проверять совместимость, но не становятся schema owners.
- Derived traces, exports и retention flows обязаны сохранять linkage к canonical `subject_state_schema_version`, если строятся поверх bounded snapshot contract.

Decision rule `JSON vs normalized table`:

- Использовать JSON только для bounded per-agent state, который должен reload-иться целиком, не имеет собственной row-identity и не требует independent query/filter/order semantics.
- Использовать нормализованную таблицу для любых данных с самостоятельной identity, evidence/audit lineage, ссылками между rows, bounded collection queries или частичными mutation paths.

### 7.3 Файловые области

#### `/seed/body`

Git-tracked initialization body. This is the canonical versioned source that enters the deployment cell as a read-only seed.

#### `/seed/skills`

Git-tracked initialization skills.

#### `/seed/constitution`

Git-tracked constitutional files used for bootstrap and recovery policy.

#### `/seed/models`

Mandatory initialization directory for model bootstrap descriptors. It may contain only tiny placeholders/manifests in phase 0; cached weights do not belong here.

#### `/seed/data`

Mandatory initialization directory for bootstrap fixtures/manifests. It may remain near-empty in phase 0; runtime datasets, reports and snapshots do not belong here.

#### `/workspace/body`

Materialized writable body formed inside the container or runtime environment from `/seed/body`. Worktrees and self-modification flows operate here, not in `/seed`.

#### `/workspace/skills`

Materialized writable skills tree derived from `/seed/skills`.

#### `/models/base`

Mutable runtime model cache and base-model manifests.

#### `/models/adapters`

LoRA/QLoRA adapters.

#### `/models/specialists`

Экспортированные узкоспециализированные модели.

#### `/data/datasets`

Dataset artifacts.

#### `/data/snapshots`

Stable snapshot manifests.

Практическое правило: только `/seed/**` может быть Git-tracked initialization content. `workspace/**`, `models/**` и `data/**` являются mutable runtime areas, materialized from seed and/or produced by system activity, so they must not be treated as canonical repo source.

### 7.4 Канонические JSON-контракты

#### `StimulusEnvelope`

```json
{
  "id": "uuid",
  "source": "http|file|telegram|scheduler|resource|system",
  "occurredAt": "2026-03-18T12:00:00Z",
  "priority": "low|normal|high|critical",
  "threadId": "optional",
  "entityRefs": ["entity-1"],
  "requiresImmediateTick": false,
  "payload": {},
  "reliability": 0.92
}
```

`StimulusEnvelope` является canonical serialized intake contract perception layer. Он durable-пишется в `stimulus_inbox`, а bounded perception buffer остаётся derived working set, а не второй permanent history layer.

#### `PerceptualContext`

```json
{
  "tickId": "uuid",
  "signals": ["stimulus-1", "stimulus-2"],
  "summary": "filesystem change + high resource pressure + one direct mention",
  "urgency": 0.73,
  "novelty": 0.41,
  "resourcePressure": 0.68
}
```

#### `TickDecision`

```json
{
  "observations": ["..."],
  "interpretations": ["..."],
  "winningCoalition": {
    "id": "coalition-1",
    "vector": "act",
    "strength": 0.81
  },
  "affectPatch": {},
  "goalOps": [],
  "action": {
    "type": "tool_call|none|reflect|schedule_job",
    "tool": "optional",
    "args": {}
  },
  "episode": {
    "summary": "...",
    "importance": 0.64
  },
  "developmentHints": []
}
```

#### `ModelProfile`

```json
{
  "id": "profile-reflex-qwen-small-v3",
  "role": "reflex",
  "provider": "vllm",
  "endpoint": "http://vllm-fast:8000/v1",
  "baseModel": "qwen/...",
  "adapter": null,
  "capabilities": {
    "jsonMode": true,
    "maxContext": 32768,
    "code": false
  },
  "status": "active"
}
```

#### `DevelopmentProposal`

```json
{
  "id": "proposal-123",
  "kind": "model_adapter|specialist_model|code_change",
  "problemSignature": "retrieval-ranking-regression",
  "evidence": ["eval-run-1", "episode-7"],
  "expectedGain": {
    "quality": 0.12,
    "latency": -0.30
  },
  "rollbackPlan": "snapshot-41"
}
```

### 7.5 Retention и compaction policy

Чтобы timeline и observability не раздувались бесконтрольно, нужна явная политика хранения.

| Класс данных | Каноническая политика |
|---|---|
| `ticks` | хранить постоянно, но без тяжёлых payload; старые строки можно партиционировать помесячно |
| `episodes` | хранить постоянно как биографию; допускается cold-storage копия |
| `field_journal_entries` | `ttl` + compaction в narrative/episodes |
| `homeostat_snapshots` | хранить подробно 30 дней, затем агрегировать по окнам |
| `action_log` | хранить постоянно; допускается сжатие старых `result_json` |
| `stimulus_inbox` | purge после нормализации и включения в тик/эпизод |
| `datasets` и `eval_runs` | хранить по policy workshop; кандидаты без promotion можно архивировать |
| `training_runs` | хранить постоянно как часть developmental biography |

Правило: биография и ledger развития удаляться не должны; удаляться или агрегироваться могут только производные технические следы.

---

## 8. Коммуникационные протоколы между компонентами

### 8.1 Внешние API

Mastra Server используется как HTTP ingress с custom routes.

Минимальный набор API:

- `POST /ingest`
- `POST /control/tick`
- `POST /control/freeze-development`
- `GET /state`
- `GET /timeline`
- `GET /episodes`
- `GET /models`
- `GET /health`

Формат — `application/json`.

### 8.2 Внутренний протокол core ↔ model organs

Используется HTTP/JSON по внутренней Docker network.

#### Generative organs

- OpenAI-compatible `/v1/chat/completions`
- при необходимости `/v1/completions`

#### Embeddings

- `/v1/embeddings`

#### Pooling / scoring

Абстрагируются через **Model Router API** внутри core, чтобы остальная система не зависела от деталей vLLM pooling protocol.

### 8.3 Внутренний протокол core ↔ workshop

Рекомендуется внутренний HTTP/JSON API + файловые артефакты в volume.

Примеры эндпоинтов:

- `POST /datasets/build`
- `POST /train/lora`
- `POST /train/specialist`
- `POST /eval/run`
- `POST /artifacts/promote`
- `POST /artifacts/rollback`

### 8.4 Внутренний протокол core ↔ PostgreSQL

- SQL over PostgreSQL wire protocol
- транзакции на тик
- lease-based workers для background jobs
- advisory locks / row locks для предотвращения overlapping lifecycle actions

### 8.5 Внутренний протокол core ↔ Git body

Не давать агенту прямой raw shell-access к Git.

Использовать **Git Gateway** — модуль/сервис-обёртку, который разрешает только понятные операции:

- `createWorktree(baseRef, branch)`
- `getDiff(pathspec?)`
- `stage(paths)`
- `commit(message)`
- `tagStable(name)`
- `checkoutStable(tag)`
- `runHooks()`
- `runBodyTestSuite(profile)`

### 8.6 Внутренний событийный формат

Рекомендуется единый event envelope:

```json
{
  "eventId": "uuid",
  "eventType": "tick.completed",
  "occurredAt": "ISO-8601",
  "subjectRef": "tick-42",
  "payload": {}
}
```

События пишутся в timeline / observability sink, но не заменяют доменную модель.

---

## 9. Жизненный цикл агента

### 9.1 Boot sequence

```text
1. Загрузить constitutional shell
2. Проверить версии схемы и volumes
3. Проверить health PostgreSQL и model servers
4. Определить режим старта: normal / degraded / recovery
5. Если нужно, откатить код/модели к последнему stable snapshot
6. Загрузить agent_state и bounded subject-state snapshot; narrative spine и active memetic field подключаются следующими seams
7. Запустить scheduler и tick engine
8. Войти в DORMANT или обработать накопленный stimulus backlog
```

### 9.2 Основной тик

```text
1. Intake stimulus/event
2. Start tick transaction
3. Build context
4. Activate memetic arena
5. Select model organs
6. Call Mastra Decision Agent
7. Validate structured decision
8. Execute one action or conscious inaction
9. Encode episode
10. Update PSM, memetic state, goals, beliefs, narrative, ledger
11. Commit tick
```

### 9.3 Consolidation cycle

Назначение:

- compaction field journal;
- promote repeated candidates into durable memetic units;
- merge/split/decay/quarantine/retire memetic units;
- summarize repeated episodes;
- create dataset candidates;
- retire stale tensions;
- prepare evaluation hypotheses.

### 9.4 Developmental cycle

Назначение:

- рассмотреть accumulated improvement proposals;
- решить, нужен ли fine-tuning;
- решить, нужен ли specialist model;
- решить, нужен ли code change proposal;
- не выполнять высокорисковые изменения напрямую, а ставить их в review/workshop pipeline.

### 9.5 Recovery cycle

Запускается, если:

- boot failure после недавнего code/model promotion;
- continuity error;
- catastrophic eval regression;
- health degradation organs;
- homeostat freeze condition.

Recovery делает:

- freeze developmental changes;
- rollback to last stable snapshot;
- log incident в development ledger;
- annotate unresolved wound в field journal / goals.

### 9.6 Graceful shutdown

Остановка тоже должна быть частью жизненного цикла, а не аварийной дырой в биографии.

Канонический порядок:

```text
1. Поставить lifecycle state = shutting_down
2. Запретить старт новых тиков
3. Дождаться завершения активного тика или выполнить bounded cancel
4. Сбросить perception buffer и scheduler leases
5. Сохранить agent_state / subject-state / narrative / memetic deltas
6. Записать shutdown episode и open concerns
7. Остановить sensor adapters
8. Закрыть model-router connections
9. Завершить процесс
```

Если shutdown вызван recovery или human override, причина обязана попасть в development ledger и observability-репорты.

---

## 10. Подсистема локальных моделей

### 10.1 Общая стратегия

Подсистема локальных моделей строится как **registry of organs**, а не как один hardcoded model string.

Каждый organ описывается профилем:

- роль;
- endpoint;
- base model;
- adapter;
- capabilities;
- limits;
- health state;
- allowed use cases.

### 10.2 Минимальный состав органов

#### `reflex`

Малый instruct model.

Используется для:

- REACTIVE ticks;
- fast summarization;
- первичной фильтрации;
- low-cost drafts.

#### `deliberation`

Средний/крупный instruct বা coder model.

Используется для:

- DELIBERATIVE ticks;
- сложное планирование;
- long-context integration;
- difficult trade-off reasoning.

#### `reflection`

Может быть отдельным профилем или adapter-over-deliberation.

Используется для:

- CONTEMPLATIVE ticks;
- narrative integration;
- self-critique;
- developmental analysis.

#### `code`

Выделенный профиль для:

- diff reasoning;
- patch generation;
- code review.

#### `embedding`

Используется для:

- semantic indexing;
- candidate retrieval.

#### `reranker`

Используется для:

- reranking top-k memory/doc/entity candidates.

#### `classifier / safety`

Используется для:

- risk scoring;
- trust scoring;
- salience gating;
- policy flags.

### 10.3 Model Router policy

Router использует простое правило выбора:

```text
выбор organ = f(
  tick_mode,
  task_kind,
  latency_budget,
  risk,
  context_size,
  required_capabilities,
  organ_health,
  last_eval_score
)
```

#### Baseline Router Invariants

- Delivered baseline roles для router-owned phase-0/1 surface фиксируются как `reflex`, `deliberation` и `reflection`; richer roles (`code`, `embedding`, `reranker`, `classifier`, `safety`, external consultants) остаются future-owned seams.
- `reflection` допустим только как explicit profile или explicit adapter-over-deliberation mapping. Hidden fallback from contemplative routing to plain `deliberation` without such explicit record запрещён.
- `selection` и `admission` — разные этапы: router выбирает eligible organ/profile или возвращает refusal, а runtime решает, допускается ли конкретный tick/execution path на текущей фазе.
- Unsupported or unhealthy routing outcome должен приводить к structured refusal, а не к silent remap или "best effort" implicit fallback.
- Router diagnostics enrich existing health/introspection baseline, но не заменяют platform-owned `GET /health` и не открывают отдельную authority over readiness or startup dependencies.
- Детальные decision tables, continuity persistence и test matrix для delivered baseline router остаются feature-local contract `F-0008`; architecture фиксирует только этот minimal invariant set.

### 10.4 Файнтюнинг generative organs

#### Цель

Не хранить факты в весах, а:

- улучшать доменную ловкость;
- закреплять полезные reasoning patterns;
- сокращать стоимость повторяющихся ходов;
- стабилизировать tool use;
- улучшать style/format adherence.

#### Источники данных

- successful episodes;
- corrected actions;
- reviewed code diffs;
- curated human feedback;
- accepted reflective summaries;
- filtered memory extractions.

#### Канонический pipeline

```text
1. Candidate mining from episodes / reviews / evaluations
2. Deduplication and redaction
3. Split: train / validation / holdout
4. SFT via TRL + PEFT LoRA/QLoRA
5. Offline eval + regression eval
6. If pass -> register adapter candidate
7. Shadow deploy / staged deploy
8. Promote or rollback
```

### 10.5 Почему LoRA/QLoRA как основной путь

Потому что он:

- дешевле полного retraining;
- быстрее;
- лучше подходит для локального workshop;
- упрощает rollback;
- позволяет иметь несколько role-specific adapters поверх общей базы.

### 10.6 Создание специализированных моделей

#### Когда имеет смысл

Только если выполнены условия:

- есть повторяющаяся задача;
- существует measurable bottleneck;
- маленькая модель реально дешевле/быстрее/стабильнее;
- задача достаточно узкая, чтобы specialist model была оправдана.

#### Какие specialist models уместны в первую очередь

- tool routing classifier;
- risk classifier;
- memory salience scorer;
- reranker;
- code review critic;
- domain classifier;
- anomaly detector.

#### Pipeline рождения специалиста

```text
1. Governor фиксирует повторяющийся task signature
2. Workshop строит датасет из episodes/evals/human labels
3. Обучается small model / classifier / reranker
4. Выполняется offline + scenario eval
5. Модель регистрируется как organ
6. Router начинает использовать её на ограниченной доле traffic
7. При деградации organ retire-ится
```

### 10.7 Что считается недопустимым model development

- выпуск specialist model без отдельной метрики пользы;
- promotion адаптера без holdout-eval;
- обучение на сырой непроверенной autobiographical prose;
- смешение facts и aspirations в train set;
- автоматическая замена active organ без stable fallback.

### 10.8 Rollout strategy для моделей

Использовать staged rollout:

1. `candidate`
2. `shadow`
3. `limited-active`
4. `active`
5. `stable`

Любой organ profile должен иметь:

- predecessor;
- rollback target;
- last known good eval report.

---

## 11. Управление кодом и интеграция с Git

### 11.1 Код рассматривается как тело

Поэтому код нельзя менять напрямую из основного runtime без дисциплины.

### 11.2 Канонический flow code change

```text
1. Governor формирует CodeChangeProposal
2. Git Gateway создаёт branch + worktree inside the materialized writable body, not inside `/seed`
3. Агент работает только внутри этого runtime worktree
4. Применяет editor tool / restricted shell scripts
5. Запускает hooks + unit/smoke/invariant tests
6. Запускает eval suite
7. Если pass -> candidate commit
8. Review gate (LLM critic + optional human)
9. Promote to stable tag or reject
10. Snapshot body + model map
```

### 11.3 Git-конвенции

#### Рефы

- `main` / `trunk` — стабильная линия
- `agent/proposals/*` — ветки предложений
- `agent/experiments/*` — краткоживущие эксперименты
- `stable/*` — стабильные теги

#### Worktrees

Каждое заметное изменение тела делается в отдельном worktree, созданном внутри materialized writable body, производного от `/seed/body`.

Это нужно, чтобы:

- не ломать живое тело;
- не смешивать эксперименты;
- иметь чистый rollback path.

#### Hooks

Hooks используются для:

- format/lint checks;
- policy validation;
- test suite triggers;
- snapshot manifest validation.

### 11.4 Review policy

Минимально допустимый review gate:

- structural diff analysis;
- test pass;
- invariant suite;
- change summary;
- rollback availability.

Для high-risk changes обязательно добавить human review.

### 11.5 Stable snapshot

Stable snapshot связывает воедино:

- git tag;
- schema version;
- active model profiles;
- critical configuration hash;
- eval summary.

Именно snapshot является настоящей «точкой возврата», а не просто commit или model adapter сам по себе.

### 11.6 Почему Git — не просто вспомогательный инструмент

Потому что без Git agent с mutable code быстро превращается в систему, у которой нет:

- дисциплины тела;
- воспроизводимости;
- понятной истории морфогенеза;
- надёжного rollback.

---

## 12. Skills и procedural layer

### 12.1 Роль skills

Skills — это процедурный слой между голым reasoning и raw tools.

Они нужны, чтобы:

- не учить модель каждый раз заново одной и той же процедуре;
- хранить repeatable know-how отдельно от identity core;
- делать улучшение процедур более дешёвым, чем fine-tuning;
- упаковывать доменные регламенты в versioned form.

### 12.2 Практическая реализация

Использовать **Mastra Workspace Skills** как каноническую форму skill packaging.

Каждый skill хранится как папка с:

- `SKILL.md`
- `references/`
- `scripts/`
- `assets/`

### 12.3 Какие skills нужны в первой версии

- `memory-curation`
- `git-governance`
- `dataset-building`
- `model-eval`
- `code-review`
- `safe-file-editing`
- `bounded-browser-research` (если нужен внешний web)

### 12.4 Где skills живут концептуально

- не в PSM;
- не в narrative spine;
- не в memetic field;
- а в procedural layer тела.

---

## 13. Инструменты и action layer

### 13.1 Принцип

Никаких действий вне action interface.

### 13.2 Группы инструментов

#### Safe data tools

- `read_file`
- `write_file_safe`
- `append_journal`
- `list_dir_allowed`

#### World/state tools

- `upsert_entity`
- `upsert_goal`
- `schedule_event`
- `enqueue_job`

#### Git/body tools

- `git_create_worktree`
- `git_diff`
- `git_stage`
- `git_commit_candidate`
- `git_tag_stable`
- `git_restore_stable`

#### Dev tools

- `run_test_profile`
- `build_dataset`
- `launch_train_run`
- `launch_eval_run`
- `promote_model_candidate`

#### Network tools

- только allowlisted HTTP via proxy/gateway

### 13.3 Restricted shell policy

Raw shell не даётся decision agent напрямую.

Разрешается только:

- через allowlisted wrappers;
- внутри approved worktree/path;
- с execution profile;
- с bounded timeout;
- с логированием и post-execution review.

---

## 14. Безопасность и изоляция

### 14.1 Базовый принцип

Контейнеризация нужна не только ради деплоя, а как часть онтологии тела.

### 14.2 Сетевая схема

- `core_net` — ingress/API
- `models_net` — только внутренняя связь core ↔ vLLM/workshop
- `db_net` — только core/workshop ↔ PostgreSQL
- опциональный `egress_proxy_net` — если разрешён внешний доступ

### 14.3 Контейнерные ограничения

Для `polyphony-core` и workshop по возможности:

- non-root user;
- read-only root filesystem;
- write access только в dedicated volumes;
- `tmpfs` для временных путей;
- `cap_drop: [ALL]`;
- `security_opt: ["no-new-privileges:true"]`;
- отсутствие `docker.sock`;
- отсутствие `privileged`;
- явные resource limits.

### 14.4 Rootless posture

Где возможно, использовать rootless Docker или максимально приближённую конфигурацию, чтобы снизить риск privilege escalation.

### 14.5 Volume policy

| Mount | Назначение | R/W |
|---|---|---|
| `/seed` | tracked initialization code, skills, constitution and bootstrap manifests | RO |
| `/workspace` | writable runtime workspace hosting materialized body, skills and worktrees derived from `/seed/*` | RW для core/workshop |
| `/models` | mutable model cache, adapters and specialists | RW для workshop, RO/RW policy-controlled для core |
| `/data` | mutable datasets, reports, snapshots and other generated runtime artifacts | RW |

Все volume mounts кроме `/seed` должны считаться generated runtime state: они не являются источником истины для Git и должны храниться вне tracked repo content или быть защищены ignore policy.

### 14.6 Secrets policy

- secrets не хранятся в narrative/episodes;
- secrets redaction обязательна для dataset pipeline;
- production secrets — через Docker secrets или эквивалент;
- training data export не должен утаскивать секреты в model artifacts.

### 14.7 Safety kernel

Часть правил должна быть вынесена в неизменяемый или отдельно ревьюируемый safety kernel:

- запрещённые действия;
- правила выхода в сеть;
- правила promotion code/model changes;
- максимумы budgets.

### 14.8 Human override

Должен существовать внешний контрольный канал:

- freeze development;
- force rollback;
- disable external network;
- require human review for all promotions.

---

## 15. Observability и диагностика

### 15.1 Что нужно измерять

#### Identity continuity metrics

- частота narrative rewrite;
- goal churn;
- affect volatility;
- coalition dominance duration;
- rollback frequency.

#### Cognitive metrics

- tick latency;
- model routing distribution;
- retrieval hit quality;
- action success rate;
- reflective usefulness.

#### Development metrics

- train run pass rate;
- adapter promotion success;
- code proposal acceptance rate;
- regression frequency.

#### Body metrics

- CPU/GPU load;
- memory pressure;
- queue depth;
- model server health;
- disk usage for artifacts.

### 15.2 Логи и трассировка

Нужно логировать как минимум:

- tick start/end;
- selected coalition;
- selected organ profile;
- tool calls;
- development proposals;
- promotions/rollbacks;
- freeze events.

Raw chain-of-thought не хранить как источник истины.

### 15.3 Репорты, которые должны существовать с первой рабочей версии

- tick timeline report;
- identity continuity report;
- model organ health report;
- development ledger report;
- stable snapshot inventory.

### 15.4 Стартовые пороги и автоматические реакции

Homeostat должен иметь не только метрики, но и дефолтные пороги реакции. Их нельзя считать окончательными — они подлежат калибровке, — но система не должна стартовать без базовых guardrails.

| Сигнал | Warning | Critical | Автоматическая реакция |
|---|---|---|---|
| `affect_volatility` | > 0.45 | > 0.70 | ограничить affect patch, поднять reflective counterweight |
| `goal_churn` | > 0.30 | > 0.50 | запретить новые goal promotions вне urgent path |
| `coalition_dominance` | > 5 тиков | > 12 тиков | anti-monoculture recall, forced alternative search |
| `narrative_rewrite_rate` | > 2/сутки | > 5/сутки | freeze narrative edits кроме incident-annotation |
| `development_proposal_rate` | > 3/сутки | > 6/сутки | freeze procedural/model/code proposals |
| `resource_pressure` | > 0.75 | > 0.90 | запретить heavy jobs, понизить tick ambition |
| `organ_error_rate` | > 0.05 | > 0.15 | router quarantine organ, fallback на predecessor |
| `rollback_frequency` | > 2/неделю | > 4/неделю | full developmental freeze + human review |

Идея этих порогов проста: Полифония должна уметь быть не только умной, но и операционно вменяемой.

---

## 16. План поэтапной реализации

### Фаза 0. Каркас

Цель: получить технический скелет без полноценной внутренней жизни.

Состав:

- `polyphony-core`
- PostgreSQL
- один `vllm-fast`
- базовый Mastra Agent
- minimal boot shell
- ticks + episodes + PSM
- basic tools

Результат:

- агент живёт тиками;
- пишет эпизоды;
- умеет простые действия;
- есть одна линия времени.

### Фаза 1. Живая минимальная Полифония

Добавить:

- narrative spine;
- field journal;
- memetic units + coalitions;
- homeostat;
- explicit executive center;
- model router;
- second model profile (`deliberation`).

Результат:

- мысли рождаются из внутренней конкуренции паттернов;
- есть различие reactive / deliberative / contemplative.

### Фаза 2. Local model ecology

Добавить:

- `vllm-pool`;
- embeddings + reranking;
- registry of model profiles;
- health checks organs;
- skill packaging.

Результат:

- локальная модельная экология становится реальностью.

### Фаза 3. Development workshop

Добавить:

- `polyphony-workshop`;
- dataset builder;
- LoRA/QLoRA pipeline;
- eval suites;
- candidate/promotion/rollback flow;
- development ledger.

Результат:

- агент начинает управляемо улучшать свои модели.

### Фаза 4. Specialized organs

Добавить:

- classifier/reranker specialist pipeline;
- organ registry expansion;
- stage rollout policy;
- retirement policy.

Результат:

- появляется настоящая органическая специализация.

### Фаза 5. Controlled somatic evolution

Добавить:

- Git worktree automation;
- code change proposals;
- body eval suite;
- stable snapshots;
- boot rollback.

Результат:

- агент получает ограниченную способность менять тело без утраты identity continuity.

### Фаза 6. Mature governance

Добавить:

- stronger human gates;
- policy profiles;
- optional external consultants;
- richer sensor adapters and perception policies;
- richer observability.

Результат:

- зрелая система с управляемой автономией.

---

## 17. Главные инженерные решения и обоснования

### 17.1 Почему core memory custom, а не только Mastra memory

Потому что Полифонии нужны custom ontological invariants: PSM, memetics, narrative continuity, development ledger, homeostasis.

### 17.2 Почему model servers вынесены наружу

Потому что:

- их проще масштабировать;
- проще обновлять;
- проще разделять профили;
- падение organ server не должно убивать core process.

### 17.3 Почему workshop отдельный

Потому что training:

- тяжёлый;
- долгий;
- потенциально нестабильный;
- не должен мешать жизни тиков.

### 17.4 Почему Git обязателен уже до code self-modification

Потому что без него невозможно построить дисциплину тела, stable snapshots и recovery path.

### 17.5 Почему нужно отличать specialist models от personality

Потому что иначе каждая удачная маленькая модель начнёт восприниматься как «новый субъект», а это ломает концепцию.

### 17.6 Какие repo-level решения закреплены после первых implementation cycles

После реализации первых двух фич некоторые решения подняты из feature-local ADR на уровень репозитория, потому что они влияют почти на каждую следующую поставку:

- канонический toolchain: [ADR-2026-03-19 Canonical Runtime Toolchain](../adr/ADR-2026-03-19-canonical-runtime-toolchain.md);
- phase-0 runtime boundary (`TypeScript + Mastra + Hono`, но health-only public surface): [ADR-2026-03-19 Phase-0 Runtime Boundary](../adr/ADR-2026-03-19-phase0-runtime-boundary.md);
- обязательная phase-0 deployment cell и baseline container posture: [ADR-2026-03-19 Phase-0 Deployment Cell](../adr/ADR-2026-03-19-phase0-deployment-cell.md);
- constitution-driven boot dependency set и связь boot с delivered substrate: [ADR-2026-03-19 Boot Dependency Contract](../adr/ADR-2026-03-19-boot-dependency-contract.md);
- canonical quality/style gate ordering и единый formatter/linter contract для source и tests: [ADR-2026-03-19 Quality Gate Sequence](../adr/ADR-2026-03-19-quality-gate-sequence.md).

Эти ADR не заменяют feature dossiers, а фиксируют cross-cutting engineering contract для следующих feature seams.

### 17.7 Architecture Coverage Map

Эта карта отделяет concept coverage от delivery status. Наличие архитектурного описания или backlog owner-а не означает, что seam уже поставлен; delivery claim появляется только у real dossier со статусом `done`.

| Architecture area | Canonical owner | Status | Note on missing work |
|---|---|---|---|
| Boot/recovery boundary | `F-0001` | `done` | Constitutional boot/recovery delivered; richer incident/governance reactions remain future-owned. |
| Platform substrate, deployment cell and verification baseline | `F-0002`, `F-0006`, `F-0007` | `done` | Phase-0 cell, quality gates and deterministic smoke are delivered; mature hardening and richer CI/CD remain separate future seams. |
| Tick runtime and continuity bridge | `F-0003` | `done` | Wake/reactive baseline is delivered; richer tick families and downstream lifecycle owners remain backlog-owned. |
| Subject-state kernel and versioned bounded snapshot | `F-0004` | `done` | Canonical subject-state store is delivered; narrative/memetic and richer cognition surfaces remain outside this seam. |
| Perception buffer and baseline adapters | `F-0005` | `done` | Baseline stimulus intake is delivered; richer policies and adapters remain future-owned. |
| Baseline model router and profile continuity | `F-0008` | `done` | Baseline router invariants are delivered; expanded model ecology and specialist organs remain future seams. |
| Context Builder and structured decision harness | `CF-017` | `confirmed` | Backlog owner exists, but the harness is not intaken or delivered yet. |
| Executive center and bounded action layer | `CF-007` | `confirmed` | Backlog owner exists; action boundary is not yet delivered. |
| Narrative and memetic cognition | `CF-005` | `confirmed` | Backlog owner exists; durable narrative/memetic surfaces are still deferred to that future seam. |
| Homeostat and operational guardrails | `CF-008` | `candidate` | Early safety reactions are described architecturally but not yet intaken. |
| Development governor and policy gates | `CF-016` | `candidate` | Minimal governor ownership is defined, but no delivered governor seam exists yet. |
| Consolidation, event envelope and graceful shutdown | `CF-018` | `candidate` | Retention/compaction and graceful shutdown biography remain backlog-owned future work. |
| Observability and reporting | `CF-015` | `candidate` | Baseline health exists, but dedicated reports, metrics, tracing and richer reactions are still deferred. |
| Operator API and introspection | `CF-009` | `candidate` | Public operator/control API beyond health remains deferred to backlog owner. |
| Expanded model ecology and registry health | `CF-010` | `candidate` | Additional organs, richer registry health and fallback policy remain future-owned. |
| Workshop training/eval/promotion pipeline | `CF-011` | `candidate` | Workshop lifecycle is architectural only; no intake or delivery yet. |
| Controlled body evolution | `CF-012` | `candidate` | Stable-snapshot consumption exists, but controlled worktree/code-evolution flow remains future-owned. |
| Skills lifecycle boundary | `CF-013` | `candidate` | Skill lifecycle ownership exists only in backlog at this point. |
| Security/perimeter hardening | `CF-014` | `candidate` | Baseline platform posture is delivered, but mature safety/perimeter controls are deferred. |
| Specialist organ rollout/retirement | `CF-019` | `candidate` | Specialist lifecycle is described conceptually, not delivered. |

---

## 18. Самопроверка по стандарту качества

### 18.1 Полнота

Проверка:

- все обязательные области концепции описаны как минимум на уровне owner map — **да**;
- delivered phase-0/early phase-1 backbone явно отделён от future seams через `done` vs backlog statuses — **да**;
- у narrative/memetic, executive, governor, observability и workshop seams есть owner в backlog, а не бесхозные обещания — **да**;
- документ больше не притворяется, что backlog-owned seams уже operationally closed, только потому что они описаны — **да**.

Вывод: по полноте архитектура закрывает обязательные области как ownership map, но честно различает delivered backbone и deferred future seams.

### 18.2 Реализуемость

Проверка:

- для delivered seams определены concrete runtime/storage/process boundaries — **да**;
- для confirmed/candidate seams указаны backlog owners, так что следующий intake может опираться на явные cross-cutting contracts — **да**;
- self-check больше не смешивает "описано" и "поставлено", поэтому инженер видит, где нужен новый dossier, а где уже есть delivered foundation — **да**.

Вывод: инженер может продолжать реализацию по этому документу без изобретения структуры с нуля и без ложного ощущения, что все описанные seams уже поставлены.

### 18.3 Согласованность

Проверка:

- second subject не вводится — **да**;
- identity не живёт в модели — **да**;
- background jobs не получают волю — **да**;
- development подчинён governor как architectural target, но сам governor ещё backlog-owned — **да**;
- code evolution не обходит Git/review как invariant, хотя mature somatic evolution ещё future-owned — **да**.

Вывод: архитектура согласована с концептуальными инвариантами и теперь явно показывает, какие из них уже operationally enforced, а какие пока закреплены только как future-owned contracts.

### 18.4 Обоснованность

Проверка:

- решения по Postgres, vLLM, workshop, Git и modular monolith объяснены — **да**;
- объяснено, почему не брать OM как core memory — **да**;
- объяснено, почему не делать multi-agent core — **да**.
- coverage map делает видимой разницу между уже реализованными решениями и теми, что пока только backlog-owned — **да**.

Вывод: архитектурные решения мотивированы, а статусы покрытия больше не создают ложную картину полной operational delivery.

### 18.5 Масштабируемость

Проверка:

- есть путь от MVP к зрелой системе — **да**;
- локальный стек допускает рост — **да**;
- model ecology допускает добавление органов без смены онтологии — **да**;
- development pipeline вводится поэтапно — **да**.
- coverage map показывает, какие шаги already delivered, а какие ещё надо intake/shaping before implementation — **да**.

Вывод: архитектура масштабируема без концептуального перелома и при этом не скрывает, какие стадии роста ещё только backlog-owned, а не delivered.

---

## 19. Финальная инженерная формула

```text
Polyphony Core = identity-bearing runtime.
Local Models = organs, not selves.
PostgreSQL = state kernel.
Git = body governance.
Workshop = controlled developmental metabolism.
Scheduler = physiology, not a second mind.
```

В более целостной формулировке:

> **Техническая архитектура Полифонии — это модульный монолит личности, окружённый локальными когнитивными органами и workshop-контуром развития, где память, биография, тики и развитие остаются под контролем одного identity-bearing core.**
