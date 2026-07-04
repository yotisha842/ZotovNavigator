package ru.zotov.crawler.scheduler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ru.zotov.crawler.model.ScrapedEvent;
import ru.zotov.crawler.service.AfishaScraperService;
import ru.zotov.crawler.service.EventPublisher;

import java.util.List;

/** По расписанию скрапит афишу и публикует найденные события в Kafka. */
@Slf4j
@Component
public class AfishaCrawlScheduler {

    private final AfishaScraperService scraperService;
    private final EventPublisher eventPublisher;

    public AfishaCrawlScheduler(AfishaScraperService scraperService, EventPublisher eventPublisher) {
        this.scraperService = scraperService;
        this.eventPublisher = eventPublisher;
    }

    @Scheduled(initialDelayString = "${app.crawler.initial-delay-ms:5000}",
            fixedDelayString = "${app.crawler.interval-ms:3600000}")
    public void crawl() {
        List<ScrapedEvent> events = scraperService.scrape();
        events.forEach(eventPublisher::publish);
    }
}
