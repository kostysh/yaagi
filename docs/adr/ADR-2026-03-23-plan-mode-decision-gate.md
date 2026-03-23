# ADR-2026-03-23 Plan Mode Decision Gate For Dossier Steps

- Status: Accepted
- Date: 2026-03-23
- Related: [AGENTS.md](../../AGENTS.md), [ADR-2026-03-23-no-technical-debt-rule.md](./ADR-2026-03-23-no-technical-debt-rule.md)

## Context

`spec-compact` и `plan-slice` регулярно содержат самые дорогие ошибки workflow:

- неверная граница feature ownership;
- слабый slice sequencing;
- неявный cross-cutting ADR;
- скрытый technical debt, который обнаруживается уже после материализации артефактов.

У Codex есть Plan mode, который полезен как немутирующая фаза анализа и согласования. Но сам dossier workflow опирается на canonical artefacts, а Plan mode не создаёт их и не может считаться выполнением `spec-compact` или `plan-slice`.

Если не зафиксировать явное правило, возникают две плохие крайности:

- Plan mode не используется даже там, где он снизил бы риск ошибочного shaping/planning;
- Plan mode начинает подменять собой реальный dossier step, хотя его вывод остаётся лишь предварительным reasoning.

## Decision

Репозиторий вводит обязательный pre-step decision gate для `spec-compact` и `plan-slice`.

Перед началом каждого такого шага исполнитель обязан явно оценить, нужен ли Plan mode, и сделать результат этой оценки наблюдаемым.

Критерии, которые обычно указывают на необходимость Plan mode:

- есть несколько правдоподобных вариантов границы scope или ownership;
- вероятен новый repo-level ADR или cross-cutting invariant;
- есть несколько реалистичных slicing/sequencing strategies;
- verification strategy, runtime boundary или deployment impact пока неочевидны;
- цена ошибочного shaping/planning заметно выше цены дополнительного согласовательного цикла.

Если по результату оценки Plan mode нужен, исполнитель не должен продолжать шаг сразу. Он обязан задать пользователю точную фразу:

`По следующим причинам <описание причин> на данном шаге рекомендуется использование режима планирования перед шагом воркфлоу досье <название шага>. Если вы согласны - включите режим планирования.`

После этого исполнитель останавливается и ждёт решения пользователя.

Если по результату оценки Plan mode не нужен:

- исполнитель кратко сообщает об этом в user update, с которого начинается шаг;
- после этого шаг продолжается в обычном mutating режиме без дополнительной остановки.

Если пользователь согласен:

- Plan mode используется только как preparatory analysis/alignment phase;
- после выхода из Plan mode canonical dossier workflow продолжается в обычном mutating режиме;
- обязательными остаются только те canonical artefacts, checks, debt review и independent review gate, которые и так требуются для реального dossier step.

Если пользователь не согласен:

- шаг выполняется в обычном режиме;
- отказ от Plan mode не отменяет requirements на quality, debt review и review gate.

## Consequences

- `spec-compact` и `plan-slice` получают обязательную upfront-оценку на предмет сложных развилок.
- Plan mode становится управляемым инструментом качества, а не неявным обходом dossier workflow.
- Пользователь получает контроль над дополнительным planning cycle в тех точках, где он реально может изменить качество решения.
