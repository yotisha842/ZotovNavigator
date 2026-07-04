# zotov-events-crawler

Микросервис-краулер афиши Центра «Зотов». Независим от основного приложения
`zotov-navigator` — отдельный Maven-проект, свой `pom.xml`, свой запускаемый jar.

По расписанию (по умолчанию — раз в час, первый прогон через 5 секунд после старта)
скрапит страницу `https://centrezotov.ru/events/` через [jsoup](https://jsoup.org/)
и публикует найденные события в Kafka-топик `zotov.events`. Основное приложение
`zotov-navigator` читает этот топик и сохраняет события в БД
(см. `ru.zotov.navigator.kafka.EventIngestListener` в основном проекте).

## Запуск

Нужен доступный Kafka-брокер (см. `docker-compose.yml` в корне репозитория:
`docker compose up -d` поднимает однонодовый Kafka в KRaft-режиме на `localhost:9092`).

```bash
./mvnw -f crawler-service/pom.xml spring-boot:run
```

Без брокера сервис тоже запускается — публикация событий просто будет падать
с предупреждениями в лог (переподключение в фоне), приложение не упадёт.

## Конфигурация (`application.yml` / переменные окружения)

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | адрес Kafka |
| `AFISHA_URL` | `https://centrezotov.ru/events/` | страница афиши для скрапинга |
| `EVENTS_TOPIC` | `zotov.events` | топик публикации событий |

## Формат сообщения (`EventMessage`)

JSON без Kafka-заголовков типа (`spring.json.add.type.headers: false`), даты — строки ISO-8601:

```json
{
  "title": "Дзига Вертов. Киноглаз",
  "description": null,
  "startTime": "2026-02-26T11:00:00",
  "endTime": "2026-07-26T22:00:00",
  "type": "EXHIBITION",
  "posterUrl": "https://centrezotov.ru/wp-content/uploads/.../poster.jpg",
  "sourceUrl": "https://centrezotov.ru/events/dziga-vertov-kinoglaz/",
  "zoneHint": null
}
```

## Разметка сайта может измениться

Селекторы в `AfishaScraperService` (`div.catalog-card`, `.catalog-card__sub`,
`.catalog-card__date`, `.catalog-card__tag`, `.catalog-card__img img[data-src]`)
завязаны на текущую вёрстку `centrezotov.ru`. Если сайт обновит тему — краулер
не упадёт, просто перестанет находить карточки (в логе будет видно
«найдено N карточек, распознано 0 событий») — селекторы нужно будет поправить.
