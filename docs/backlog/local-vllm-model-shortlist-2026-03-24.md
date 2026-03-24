# Локальный shortlist моделей для vLLM — 2026-03-24

> Локальная планировочная записка, не SSoT.
> Этот файл привязан к конкретной машине и нужен оператору. Он не меняет архитектурные требования и не должен рассматриваться как feature dossier.

## Назначение

Зафиксировать первый shortlist кандидатов, дружественных к `vLLM`, для этой рабочей станции, чтобы к моменту реального выбора `fast` / `deep` / `pool` не пришлось заново поднимать весь ресёрч.

Целевые роли берутся из архитектуры, а не из этой записки:

- `vllm-fast`: низколатентный generative organ для reactive ticks, summary, дешёвых draft-ов и route preselection.
- `vllm-deep`: более медленный generative organ для deliberative / contemplative / code-heavy задач.
- `vllm-pool`: embeddings / reranking / classification.

См.:

- [Архитектура: model services](../architecture/system.md)
- [Архитектура: registry of organs](../architecture/system.md)
- [Досье: baseline router и organ profiles](../features/F-0008-baseline-model-router-and-organ-profiles.md)

## Снимок локальной системы

Собрано `2026-03-24` из локальных команд:

- `llmfit system`
- `free -h`
- `rocminfo`
- `rocm-smi`
- `amd-smi metric --gpu 0 --json`

Наблюдаемые факты:

- CPU: `AMD RYZEN AI MAX+ PRO 395`
- Ядер: `32`
- RAM: `122.82 GiB`
- Доступно RAM на момент замера: около `96 GiB`
- Класс GPU: `Ryzen AI MAX / Radeon 8060S`, `gfx1151`
- Локально присутствует стек `ROCm 7.1.1`
- Важная оговорка: это APU с unified memory. ROCm telemetry показывает только около `512 MB` как явный `VRAM`, а большой общий пул отдаёт как `GTT`, поэтому часть утилит может занижать реальную ёмкость ROCm-пути.

Замечание оператора:

- `llmfit` полезен для относительной оценки размеров, но его цифры на этой машине основаны на эвристиках в стиле `llama.cpp` и не являются прямым предсказанием реального memory profile под `vLLM`.
- `vllm` локально не установлен на момент этой записки, поэтому `vLLM` smoke test на этой машине ещё не выполнялся.

## Базовая совместимость

По состоянию на `2026-03-24` upstream `vLLM` документирует поддержку:

- AMD ROCm на Linux
- `Ryzen AI MAX / AI 300 Series (gfx1151/1150)`
- для этого класса устройств нужен `ROCm 7.0.2+`
- для ROCm рекомендован Docker-путь

На бумаге эта машина под базовую совместимость подходит.

## Предположение о деплое для этой записки

Для будущей оценки предполагаем:

- `vLLM` работает внутри deployment cell Полифонии как набор контейнеризированных сервисов.
- `vLLM` не запускается из host OS как ad hoc локальная установка.
- `vLLM` также не разделяет один container image / process boundary с `polyphony-core`.

Рабочая форма:

- `polyphony-core`
- `vllm-fast`
- `vllm-deep`
- `vllm-pool`

Почему:

- это соответствует архитектуре репозитория, сохраняет изоляцию ресурсов и позволяет назначать независимые limits / health checks / restarts тяжёлым inference-сервисам, не связывая их с identity-bearing core runtime.

## Метки уверенности

- `confirmed`: найден явный пример в документации `vLLM` или явная запись в supported-models.
- `inferred`: совместимость выведена по поддерживаемому семейству архитектур или по lineage модели, но конкретный checkpoint не был явно найден в поднятой странице.
- `defer`: кандидат, вероятно, полезный позже, но слишком тяжёлый или слишком неопределённый для первого прохода на рабочей машине.

## Shortlist

### `fast`

1. `Qwen/Qwen3-8B`
   - Уверенность: `confirmed`
   - Почему: upstream `vLLM` явно перечисляет `Qwen3ForCausalLM` с примером `Qwen/Qwen3-8B`.
   - Назначение: хороший первый default для `vllm-fast`, если нужен один современный general-purpose text model.
   - Риск: под `vLLM` это всё ещё не "маленькая" модель; не стоит переносить на неё ожидания от квантованного `llama.cpp`.

2. `microsoft/Phi-4-mini-instruct`
   - Уверенность: `confirmed`
   - Почему: upstream `vLLM` явно перечисляет `Phi3ForCausalLM` с примером `microsoft/Phi-4-mini-instruct`.
   - Назначение: консервативный `fast`, если важнее сохранить отзывчивость рабочего стола, чем выжать максимум качества.
   - Риск: слабее Qwen-класса для широкого deliberation; лучше держать его на reactive / cheap-draft роли.

3. `Qwen/Qwen3-4B`
   - Уверенность: `inferred`
   - Почему: то же семейство `Qwen3ForCausalLM`, что и у явно поддержанного `Qwen/Qwen3-8B`.
   - Назначение: возможный более дешёвый `fast`, если `8B` окажется слишком дорогим под реальными замерами `vLLM`.
   - Риск: требует реального smoke test на этой машине перед повышением в primary candidate.

### `deep`

1. `deepseek-ai/DeepSeek-R1-Distill-Qwen-14B`
   - Уверенность: `inferred`
   - Почему: DeepSeek публикует эту линию как distilled checkpoints на базе семейства `Qwen2.5`; upstream `vLLM` явно поддерживает `Qwen2ForCausalLM`.
   - Назначение: самый правдоподобный первый `deep`, который всё ещё лучше уважает ограничение рабочей станции, чем варианты 30B+.
   - Риск: reasoning-tuned модели всё равно могут быть тяжёлыми под `vLLM`; нужен реальный ROCm runtime замер.

2. `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B`
   - Уверенность: `inferred`
   - Почему: та же логика, что у варианта `14B`, но безопаснее как стартовый workstation baseline.
   - Назначение: вариант `deep-lite`, если `14B` слишком дорого держать тёплым во время обычной работы.
   - Риск: может слишком приблизиться по качеству к `fast`, если `fast` уже сильный, например `Qwen3-8B`.

3. `Qwen/QwQ-32B-Preview`
   - Уверенность: `confirmed`
   - Почему: upstream `vLLM` явно перечисляет его под `Qwen2ForCausalLM`.
   - Назначение: потолочный эксперимент на будущее, не первый default.
   - Риск: слишком сильное давление на ресурсы для рабочей станции, которая должна оставаться пригодной для зарабатывания денег.

4. `Qwen/Qwen3-30B-A3B`
   - Уверенность: `confirmed`
   - Почему: upstream `vLLM` явно перечисляет `Qwen3MoeForCausalLM` с `Qwen/Qwen3-30B-A3B`.
   - Назначение: поздний эксперимент, если захочется проверить поведение MoE в роли `deep`.
   - Риск: тоже `defer` для первого деплоя, потому что суммарное runtime-давление на APU, скорее всего, будет слишком высоким.

### `pool` — embeddings

1. `BAAI/bge-base-en-v1.5`
   - Уверенность: `confirmed`
   - Почему: upstream `vLLM` использует её в качестве явного embeddings-примера.
   - Назначение: самый безопасный первый baseline для embeddings.
   - Риск: модель скорее English-first; если потом потребуется выраженная multilingual retrieval, стоит пересмотреть выбор.

2. `Qwen/Qwen3-Embedding-0.6B`
   - Уверенность: `confirmed`
   - Почему: upstream `vLLM` supported-models ссылается на `Qwen3Model` / `Qwen3ForCausalLM` для `Qwen/Qwen3-Embedding-0.6B`.
   - Назначение: современный компактный embeddings-кандидат, которого стоит сравнить с BGE.
   - Риск: перед стандартизацией нужно проверить реальный endpoint mode и качество.

3. `jinaai/jina-embeddings-v3`
   - Уверенность: `confirmed`
   - Почему: upstream `vLLM` даёт embedding-примеры для этой модели.
   - Назначение: сильный опциональный кандидат, если более высокое качество embeddings оправдает дополнительную сложность.
   - Риск: требует `trust_remote_code`; держать только за явным решением оператора.

### `pool` — reranking / scoring

1. `BAAI/bge-reranker-base`
   - Уверенность: `confirmed`
   - Почему: upstream `vLLM` rerank API использует его как явный пример модели.
   - Назначение: первый reranker-кандидат, если retrieval quality потребует второго этапа.
   - Риск: не стоит деплоить до понимания latency budget; на первом working stack reranking может быть опциональным.

2. `BAAI/bge-reranker-v2-m3`
   - Уверенность: `confirmed`
   - Почему: upstream `vLLM` score API использует его как пример.
   - Назначение: более сильный rerank / score кандидат для сравнения с `bge-reranker-base`.
   - Риск: имеет смысл только если простой reranker реально оставит измеримый quality gap.

3. `Qwen/Qwen3-Reranker-0.6B`
   - Уверенность: `confirmed`
   - Почему: upstream `vLLM` supported-models перечисляет `Qwen3ForSequenceClassification` с `Qwen/Qwen3-Reranker-0.6B`.
   - Назначение: компактный Qwen-native reranker для будущего сравнения.
   - Риск: не должен быть первым выбором, пока не измерен более простой BGE-путь.

## Рекомендуемый порядок внедрения

### Минимально безопасный стек

- `fast`: `microsoft/Phi-4-mini-instruct`
- `deep`: `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B`
- `pool/embed`: `BAAI/bge-base-en-v1.5`
- `pool/rerank`: сначала не нужен

Почему:

- минимизирует давление на ресурсы, но сохраняет архитектурное разделение между reactive generation, более глубоким reasoning и embeddings.

### Сбалансированный первый серьёзный стек

- `fast`: `Qwen/Qwen3-8B`
- `deep`: `deepseek-ai/DeepSeek-R1-Distill-Qwen-14B`
- `pool/embed`: `BAAI/bge-base-en-v1.5` или `Qwen/Qwen3-Embedding-0.6B`
- `pool/rerank`: опционально `BAAI/bge-reranker-base`

Почему:

- это самый правдоподобный "настоящий" workstation-конфиг, если машина должна оставаться отзывчивой для обычной работы.

### Поздние high-risk эксперименты

- `deep`: `Qwen/QwQ-32B-Preview`
- `deep`: `Qwen/Qwen3-30B-A3B`
- `pool/embed`: `jinaai/jina-embeddings-v3`
- `pool/rerank`: `Qwen/Qwen3-Reranker-0.6B`

Почему:

- к ним стоит переходить только после реальных benchmark-ов и понимания resource envelope у сбалансированного стека.

## Что проверить в момент реального выбора

1. Установить и прогнать `vLLM` smoke test именно на этом ROCm-стеке.
2. Для каждой модели из shortlist доказать одно из двух:
   - `vllm serve <model>` стартует чисто, или
   - `LLM(model=..., runner="generate" | "pooling")` локально работает без ошибок.
3. Измерить:
   - idle memory
   - first-request latency
   - steady-state latency
   - отзывчивость машины при открытых браузере / IDE / Docker
4. Для pooling-моделей не забывать принудительно включать pooling mode:
   - использовать `--runner pooling` или соответствующий embedding / score task path
5. Не переносить числа из `llmfit` в capacity planning для `vLLM` напрямую.

## Источники

### Внутри репозитория

- `docs/architecture/system.md`
- `docs/features/F-0008-baseline-model-router-and-organ-profiles.md`

### Upstream `vLLM`

- GPU / ROCm support:
  - https://docs.vllm.ai/en/latest/getting_started/installation/gpu.html
  - https://docs.vllm.ai/en/stable/getting_started/installation/gpu/
- Supported models:
  - https://docs.vllm.ai/en/latest/models/supported_models/
- Pooling models:
  - https://docs.vllm.ai/en/stable/models/pooling_models/
- OpenAI-compatible server docs:
  - https://docs.vllm.ai/en/v0.13.0/serving/openai_compatible_server/
  - https://docs.vllm.ai/en/v0.8.0/serving/openai_compatible_server.html
- Embedding examples:
  - https://docs.vllm.ai/en/v0.10.2/examples/offline_inference/embed_jina_embeddings_v3.html
  - https://docs.vllm.ai/en/v0.9.0/getting_started/examples/offline_inference/embed_matryoshka_fy.html

### Источники lineage для `inferred` кандидатов

- https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-14B
- https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B
