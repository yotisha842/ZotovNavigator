package ru.zotov.crawler.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import ru.zotov.crawler.model.EventMessage;
import ru.zotov.crawler.model.ScrapedEvent;

/** Публикация распарсенных событий афиши в Kafka-топик. */
@Slf4j
@Service
public class EventPublisher {

    private final KafkaTemplate<String, EventMessage> kafkaTemplate;
    private final String topic;

    public EventPublisher(KafkaTemplate<String, EventMessage> kafkaTemplate,
                           @Value("${app.crawler.events-topic}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    public void publish(ScrapedEvent event) {
        EventMessage message = EventMessage.builder()
                .title(event.title())
                .description(null)
                .startTime(event.startTime().toString())
                .endTime(event.endTime() != null ? event.endTime().toString() : null)
                .type(CategoryTypeMapper.toEventType(event.category()))
                .posterUrl(event.posterUrl())
                .sourceUrl(event.sourceUrl())
                .zoneHint(null)
                .build();

        kafkaTemplate.send(topic, message.getTitle(), message).whenComplete((result, ex) -> {
            if (ex != null) {
                log.warn("Не удалось опубликовать событие '{}' в топик {}: {}", message.getTitle(), topic, ex.getMessage());
            } else {
                log.debug("Опубликовано событие '{}' в топик {}", message.getTitle(), topic);
            }
        });
    }
}
