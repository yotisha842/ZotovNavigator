package ru.zotov.navigator.kafka;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Сообщение о событии афиши из Kafka-топика {@code zotov.events}.
 *
 * <p>Публикуется сервисом-краулером ({@code crawler-service}, пакет
 * {@code ru.zotov.crawler.model.EventMessage}). Даты — строки ISO-8601, чтобы формат
 * сообщения не зависел от Jackson-модулей на обеих сторонах.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EventMessage {

    private String title;
    private String description;
    private String startTime;
    private String endTime;
    private String type;
    private String posterUrl;
    private String sourceUrl;
    private String zoneHint;
}
