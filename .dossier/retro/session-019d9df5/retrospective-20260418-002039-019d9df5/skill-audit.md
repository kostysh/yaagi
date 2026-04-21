# Skill audit

Status: validated

## Summary

На этой фазе скилы были не декоративными, а реально управляли качеством результата. Самую большую ценность дали review-oriented skills и `dossier-engineer`. Самую заметную процессную фрикцию дал `backlog-engineer`, причём не как плохой инструмент, а как строгая система с высоким procedural cost в финальной actualization части.

## Findings by skill

### `dossier-engineer`

- Verdict: high value
- Evidence:
  - `<project-root>/.dossier/logs/F-0022/implementation-c01.md`
  - `<project-root>/.dossier/verification/F-0022/implementation-51a6827fbd2e.json`
  - `<project-root>/.dossier/steps/F-0022/implementation.json`
- Что сработало:
  - заставил вести полноценный stage log с rerun reasons и closure evidence;
  - удержал verify/review/step-close как отдельные обязательные артефакты;
  - помог не потерять backlog actualization и final closure.
- Ограничение:
  - stage-log contract пока недостаточно структурирован для machine reconstruction review loops; слишком много важного остаётся в prose.

### `backlog-engineer`

- Verdict: high value, medium friction
- Evidence:
  - `<project-root>/.dossier/logs/F-0022/implementation-c01.md`
  - `<project-root>/docs/backlog/patches/2026-04-18-001-cf013-implemented.patch.json`
  - `<project-root>/docs/backlog/patches/098d9e0db22a--2026-04-18-001-cf013-implemented.patch.json`
- Что сработало:
  - не позволил испортить backlog truth неправильным patch input;
  - заставил пройти канонический путь `actualize -> refresh -> clean attention/todo`;
  - обеспечил fail-closed поведение на invalid patch и на unsupported todo removal path.
- Фрикция:
  - monotonic `sequence` и shape patch-а легко ошибочно собрать вручную;
  - `refresh`-managed todo semantics оказались неинтуитивны и потребовали отдельного разбирательства;
  - процесс в конце фазы стал тяжелее, чем хотелось бы для “обычной” non-functional sync операции.

### `spec-conformance-reviewer`

- Verdict: very high value
- Evidence: `<project-root>/.dossier/logs/F-0022/implementation-c01.md`
- Пойманные проблемы:
  - watcher тянул live seed truth;
  - `valid` и `active` были схлопнуты;
  - invalid seed skills materialize-ились в workspace.
- Вывод:
  - для runtime seams этот skill должен оставаться первым blocking reviewer-ом, потому что ловит именно contract drift, а не только кодовые баги.

### `code-reviewer`

- Verdict: very high value
- Evidence: `<project-root>/.dossier/logs/F-0022/implementation-c01.md`
- Пойманные проблемы:
  - sync failure не был fail-closed;
  - stale seed baseline переживал full refresh failure;
  - stale queued refresh мог публиковать устаревший snapshot.
- Вывод:
  - skill хорошо работает на второй волне, когда contract уже выровнен, но implementation details ещё опасны.

### `security-reviewer`

- Verdict: very high value
- Evidence: `<project-root>/.dossier/logs/F-0022/implementation-c01.md`
- Пойманные проблемы:
  - symlink boundary bypass;
  - watcher следовал symlink target-ам вне workspace;
  - churn-based stale-state window.
- Вывод:
  - для любого file-watching/runtime-path seam этот review не опционален. Он нашёл то, что обычный correctness review легко пропускает.

### Independent review

- Verdict: high value
- Evidence: `<project-root>/.dossier/reviews/F-0022/implementation-51a6827fbd2e.json`
- Что поймал:
  - финальный race вокруг `syncFromSeed()` и watcher suppression после уже пройденных spec/code/security passes.
- Вывод:
  - независимый последний взгляд здесь был оправдан; без него фаза закрылась бы с тонкой гонкой в post-sync refresh path.

## Cross-skill observations

- Лучший результат дал именно стек из нескольких reviewer-ов с разной оптикой, а не один “общий review”.
- Самый слабый участок не в review skills, а в handoff между implementation и backlog/process closure.
- Для retrospective raw skill-hit counting мало полезен: длинный trace создаёт слишком много шума. Нужна опора на stage log и artifacts.

## Recommendations

1. Оставить `spec-conformance-reviewer`, `code-reviewer`, `security-reviewer` и final independent review обязательным стеком для runtime-affecting features.
2. Для `backlog-engineer` добавить operator-facing short recipe именно для конца implementation phase:
   `author patch -> dry-run -> apply -> refresh source -> verify clean`.
3. В `dossier-engineer` усилить структурирование review loop data, чтобы retrospective не зависела от prose parsing.
