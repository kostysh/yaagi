# SSOT Index

> Single-file navigation source of truth.  
> **Do not duplicate requirements here.** Link to Feature Dossiers instead.

_Last sync: 2026-03-23T11:29:04.459Z_

## Features

<!-- BEGIN GENERATED FEATURES -->
| ID | Title | Status | Area | Depends on | Impacts | Dossier |
|---|---|---|---|---|---|---|
| F-0001 | Конституционный контур запуска и восстановления | done | runtime | F-0002 | runtime,db,models,storage | `../features/F-0001-constitutional-boot-recovery.md` |
| F-0002 | Канонический scaffold монорепы и deployment cell | done | platform | — | runtime,infra,db,models,workspace | `../features/F-0002-canonical-monorepo-deployment-cell.md` |
| F-0003 | Тиковый runtime, scheduler и эпизодическая линия времени | done | runtime | F-0001, F-0002 | runtime,db,timeline,jobs | `../features/F-0003-tick-runtime-scheduler-episodic-timeline.md` |
| F-0004 | Ядро субъектного состояния и модель памяти | planned | memory | F-0001, F-0002, F-0003 | runtime,db,memory,state | `../features/F-0004-subject-state-kernel-and-memory-model.md` |
<!-- END GENERATED FEATURES -->

## Dependency graph

<!-- BEGIN GENERATED DEP_GRAPH -->
```mermaid
graph TD
  F0001["F-0001 Конституционный контур запуска и восстановления"]
  F0002["F-0002 Канонический scaffold монорепы и deployment cell"]
  F0003["F-0003 Тиковый runtime, scheduler и эпизодическая линия времени"]
  F0004["F-0004 Ядро субъектного состояния и модель памяти"]
  F0001 --> F0002
  F0003 --> F0001
  F0003 --> F0002
  F0004 --> F0001
  F0004 --> F0002
  F0004 --> F0003
```
<!-- END GENERATED DEP_GRAPH -->

## Red flags

<!-- BEGIN GENERATED RED_FLAGS -->
- ✅ No red flags detected.
<!-- END GENERATED RED_FLAGS -->
