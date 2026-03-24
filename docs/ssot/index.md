# SSOT Index

> Single-file navigation source of truth.  
> **Do not duplicate requirements here.** Link to Feature Dossiers instead.

_Last sync: 2026-03-24T10:33:20.365Z_

## Features

<!-- BEGIN GENERATED FEATURES -->
| ID | Title | Status | Area | Depends on | Impacts | Dossier |
|---|---|---|---|---|---|---|
| F-0001 | Конституционный контур запуска и восстановления | done | runtime | F-0002 | runtime,db,models,storage | `../features/F-0001-constitutional-boot-recovery.md` |
| F-0002 | Канонический scaffold монорепы и deployment cell | done | platform | — | runtime,infra,db,models,workspace | `../features/F-0002-canonical-monorepo-deployment-cell.md` |
| F-0003 | Тиковый runtime, scheduler и эпизодическая линия времени | done | runtime | F-0001, F-0002 | runtime,db,timeline,jobs | `../features/F-0003-tick-runtime-scheduler-episodic-timeline.md` |
| F-0004 | Ядро субъектного состояния и модель памяти | done | memory | F-0001, F-0002, F-0003 | runtime,db,memory,state | `../features/F-0004-subject-state-kernel-and-memory-model.md` |
| F-0005 | Буфер восприятия и сенсорные адаптеры | done | perception | F-0001, F-0002, F-0003 | runtime,db,ingress,perception | `../features/F-0005-perception-buffer-and-sensor-adapters.md` |
| F-0006 | Актуализация базовых зависимостей и выравнивание инструментального стека | done | platform | F-0001, F-0002, F-0003, F-0004, F-0005 | runtime,infra,toolchain,dependencies | `../features/F-0006-baseline-dependency-refresh-and-toolchain-alignment.md` |
| F-0007 | Детерминированный smoke harness и suite-scoped lifecycle deployment cell | done | platform | F-0002, F-0003, F-0004, F-0005, F-0006 | runtime,infra,verification,smoke | `../features/F-0007-deterministic-smoke-harness-and-suite-scoped-cell-lifecycle.md` |
| F-0008 | Базовый маршрутизатор моделей и профили органов | done | models | F-0002, F-0003 | runtime,db,models,cognition | `../features/F-0008-baseline-model-router-and-organ-profiles.md` |
<!-- END GENERATED FEATURES -->

## Dependency graph

<!-- BEGIN GENERATED DEP_GRAPH -->
```mermaid
graph TD
  F0001["F-0001 Конституционный контур запуска и восстановления"]
  F0002["F-0002 Канонический scaffold монорепы и deployment cell"]
  F0003["F-0003 Тиковый runtime, scheduler и эпизодическая линия времени"]
  F0004["F-0004 Ядро субъектного состояния и модель памяти"]
  F0005["F-0005 Буфер восприятия и сенсорные адаптеры"]
  F0006["F-0006 Актуализация базовых зависимостей и выравнивание инструментального стека"]
  F0007["F-0007 Детерминированный smoke harness и suite-scoped lifecycle deployment cell"]
  F0008["F-0008 Базовый маршрутизатор моделей и профили органов"]
  F0001 --> F0002
  F0003 --> F0001
  F0003 --> F0002
  F0004 --> F0001
  F0004 --> F0002
  F0004 --> F0003
  F0005 --> F0001
  F0005 --> F0002
  F0005 --> F0003
  F0006 --> F0001
  F0006 --> F0002
  F0006 --> F0003
  F0006 --> F0004
  F0006 --> F0005
  F0007 --> F0002
  F0007 --> F0003
  F0007 --> F0004
  F0007 --> F0005
  F0007 --> F0006
  F0008 --> F0002
  F0008 --> F0003
```
<!-- END GENERATED DEP_GRAPH -->

## Red flags

<!-- BEGIN GENERATED RED_FLAGS -->
- ✅ No red flags detected.
<!-- END GENERATED RED_FLAGS -->
