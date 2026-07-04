package ru.zotov.crawler.model;

import java.time.LocalDateTime;

/**
 * Разобранная карточка события со страницы афиши, ещё без привязки к Kafka-формату.
 */
public record ScrapedEvent(
        String title,
        String category,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String posterUrl,
        String sourceUrl
) {
}
