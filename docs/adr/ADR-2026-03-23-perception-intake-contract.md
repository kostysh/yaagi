# ADR-2026-03-23 Canonical Perception Intake Contract

- Status: Accepted
- Date: 2026-03-23
- Related: [F-0005](../features/F-0005-perception-buffer-and-sensor-adapters.md), [F-0003](../features/F-0003-tick-runtime-scheduler-episodic-timeline.md), [system.md](../architecture/system.md)

## Context

Архитектура уже задаёт `SensorSignal`, `SensorAdapter`, `StimulusEnvelope`, `stimulus_inbox` и perception buffer, но до shaping `F-0005` их связь оставалась недостаточно строгой:

- `SensorSignal` и `StimulusEnvelope` описывали один и тот же seam на разных уровнях без явного canonical mapping;
- `StimulusEnvelope` в `system.md` не включал `resource` как source, хотя adapter contract уже включал;
- было неясно, что именно является durable intake layer, а что только bounded working set.

Если оставить это неявным, следующие фичи (`Context Builder`, API/introspection, observability, retention) начнут читать разные представления одного и того же входного потока.

## Decision

Репозиторий фиксирует perception intake contract так:

- `SensorSignal` остаётся runtime-level adapter contract;
- perception layer нормализует каждый принятый signal в canonical `StimulusEnvelope`;
- `StimulusEnvelope.source` допускает: `http`, `file`, `telegram`, `scheduler`, `resource`, `system`;
- `StimulusEnvelope` хранит `priority` и `requiresImmediateTick`, а не только raw payload metadata;
- `stimulus_inbox` является единственным durable intake layer для normalized stimuli;
- bounded perception buffer является derived/claimable working set над `stimulus_inbox`, а не второй permanent history surface.

Interpretation rules:

- `POST /ingest` принимает внешний HTTP-ingest payload и нормализует его в тот же canonical `StimulusEnvelope`, что и internal adapters;
- adapter-specific transient metadata может жить только во runtime controller, но не должно становиться отдельным долгоживущим storage contract;
- perception retention/purge policy применяется к `stimulus_inbox`, а не к отдельному shadow buffer table.

## Alternatives

- Оставить `SensorSignal` и `StimulusEnvelope` как loosely related contracts without explicit mapping.
- Сделать perception buffer отдельной durable таблицей и хранить `stimulus_inbox` только как raw ingress journal.
- Не добавлять `resource` в canonical stimulus source set до более поздней observability фичи.

## Consequences

- `F-0005` получает один canonical serialized contract для ingress и adapter normalization.
- Следующие seams должны читать perception intake через `StimulusEnvelope`/`stimulus_inbox`, а не invent new raw-event contracts.
- Если в будущем понадобится separate append-only raw journal, это потребует нового ADR, а не тихого расширения `F-0005`.
