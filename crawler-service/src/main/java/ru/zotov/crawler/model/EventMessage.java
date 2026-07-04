package ru.zotov.crawler.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Сообщение о событии афиши, публикуемое в Kafka-топик {@code zotov.events}.
 *
 * <p>Даты передаются строками в формате ISO-8601 ({@link java.time.LocalDateTime#toString()}),
 * а не как {@code LocalDateTime}, — так сообщение остаётся простым JSON без зависимости
 * от Jackson-модуля JSR-310 на стороне потребителя.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventMessage {

    private String title;
    private String description;

    /** ISO-8601, например {@code 2026-06-26T11:00:00}. */
    private String startTime;

    /** ISO-8601, может отсутствовать, если краулер нашёл только дату начала. */
    private String endTime;

    /** Имя константы {@code ru.zotov.navigator.model.EventType} (EXHIBITION, FILM, LECTURE, CONCERT, WORKSHOP, OTHER). */
    private String type;

    private String posterUrl;

    /** Ссылка на страницу события на сайте — для отладки и трассировки источника. */
    private String sourceUrl;

    /** Необязательная подсказка для сопоставления с зоной (например, название площадки). */
    private String zoneHint;
}
