# Участие в разработке

Любые изменения в репозитории, включая документацию и конфигурацию, проходят путь `отдельный worktree и task-ветка → Pull Request → интеграция в develop`. Полная методология находится в [docs/development-methodology](docs/development-methodology/README.md); этот файл служит только короткой точкой входа и не дублирует правила.

## Перед началом

- Изучите [иерархию проектных документов](docs/development-methodology/documentation.md) и источники истины для задачи.
- Для модуля используйте его спецификацию и план имплементации; GitHub Issues служат навигацией по [методике задач](docs/development-methodology/task-methodology.md).
- Создайте worktree и task-ветку по [Git- и GitHub-процессу](docs/development-methodology/git-and-github.md).

## Во время работы

- Следуйте [правилам имплементации](docs/development-methodology/implementation.md).
- Выполняйте проверки из [политики качества](docs/development-methodology/quality.md).
- Ведите корневой `README.md` только на английском языке, проектную документацию разработки — на русском. Английские версии остальных документов создаются только по прямому запросу оператора.

## Перед Pull Request

- Обновите затронутые спецификации или планы, если изменились их решения или поведение.
- Проведите [обязательные аудиты](docs/development-methodology/audits.md).
- Создайте PR task-ветки в `develop`. PR в `master` допускается только из `develop`.
- Не создавайте коммиты изменений напрямую в `develop` или `master`; прямые push и force push в эти ветки запрещены. `develop` — default branch.
