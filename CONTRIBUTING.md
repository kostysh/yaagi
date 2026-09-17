# Участие в разработке

Разработка начинается с GitHub Issue и выполняется в отдельном worktree и task-ветке. Полная методология находится в [docs/development-methodology](docs/development-methodology/README.md); этот файл служит только короткой точкой входа и не дублирует правила.

## Перед началом

- Изучите [иерархию проектных документов](docs/development-methodology/documentation.md) и источники истины для задачи.
- Для модуля используйте его спецификацию и план имплементации; GitHub Issues служат навигацией, а не заменой этих документов.
- Создайте worktree и task-ветку по [Git- и GitHub-процессу](docs/development-methodology/git-and-github.md).

## Во время работы

- Следуйте [правилам имплементации](docs/development-methodology/implementation.md).
- Выполняйте проверки из [политики качества](docs/development-methodology/quality.md).
- Ведите проектную документацию на русском языке. Английская версия создаётся только по прямому запросу оператора.

## Перед Pull Request

- Обновите затронутые спецификации или планы, если изменились их решения или поведение.
- Проведите [обязательные аудиты](docs/development-methodology/audits.md).
- Создайте PR task-ветки в `develop`. PR в `master` допускается только из `develop`.
- Не выполняйте прямые push в `develop` или `master`.
