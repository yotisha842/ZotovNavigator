package ru.zotov.navigator.kafka;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.zotov.navigator.model.Event;
import ru.zotov.navigator.model.EventSource;
import ru.zotov.navigator.model.EventType;
import ru.zotov.navigator.model.Zone;
import ru.zotov.navigator.model.ZoneType;
import ru.zotov.navigator.repository.EventRepository;
import ru.zotov.navigator.repository.ZoneRepository;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

/**
 * Читает события афиши, опубликованные {@code crawler-service} в топик {@code zotov.events},
 * и сохраняет их в БД поверх существующих {@link EventRepository}/{@link ZoneRepository} —
 * так же, как их читают REST-контроллеры. По сути это вынесенный в отдельный сервис
 * и переведённый на Kafka аналог {@code ScraperEventSyncService}, поэтому сохранённые
 * события помечаются тем же источником — {@link EventSource#SCRAPER}.
 *
 * <p>Краулер не знает внутренних ID зон карты, поэтому зона подбирается эвристически:
 * по типу события (EventType -&gt; ZoneType) берётся первая подходящая зона. Если подходящей
 * зоны нет — событие пропускается с предупреждением в лог, ничего не падает.</p>
 *
 * <p>Слушатель можно полностью отключить свойством {@code app.kafka.enabled=false}
 * (например, если Kafka не поднята локально) — тогда бин даже не создаётся.</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "app.kafka", name = "enabled", havingValue = "true", matchIfMissing = true)
public class EventIngestListener {

    private static final Map<EventType, ZoneType> ZONE_TYPE_BY_EVENT_TYPE = Map.of(
            EventType.EXHIBITION, ZoneType.EXHIBITION,
            EventType.FILM, ZoneType.CINEMA,
            EventType.LECTURE, ZoneType.LECTURE,
            EventType.CONCERT, ZoneType.LECTURE,
            EventType.WORKSHOP, ZoneType.PUBLIC,
            EventType.OTHER, ZoneType.PUBLIC
    );

    private final EventRepository eventRepository;
    private final ZoneRepository zoneRepository;

    public EventIngestListener(EventRepository eventRepository, ZoneRepository zoneRepository) {
        this.eventRepository = eventRepository;
        this.zoneRepository = zoneRepository;
    }

    @KafkaListener(topics = "${app.kafka.events-topic:zotov.events}", groupId = "${spring.kafka.consumer.group-id:zotov-navigator}")
    @Transactional
    public void onEvent(EventMessage message) {
        if (message == null || message.getTitle() == null || message.getTitle().isBlank() || message.getStartTime() == null) {
            log.warn("Пропускаю сообщение о событии без названия или даты начала: {}", message);
            return;
        }

        LocalDateTime startTime;
        LocalDateTime endTime;
        try {
            startTime = LocalDateTime.parse(message.getStartTime());
            endTime = message.getEndTime() != null ? LocalDateTime.parse(message.getEndTime()) : null;
        } catch (DateTimeParseException e) {
            log.warn("Не удалось разобрать дату у события '{}': {}", message.getTitle(), e.getMessage());
            return;
        }

        EventType type = parseEventType(message.getType());
        Zone zone = resolveZone(message.getZoneHint(), type);
        if (zone == null) {
            log.warn("Не найдена подходящая зона для события '{}' (тип {}), пропускаю", message.getTitle(), type);
            return;
        }

        Event event = eventRepository.findByTitleAndStartTime(message.getTitle(), startTime).orElseGet(Event::new);
        event.setTitle(message.getTitle());
        event.setDescription(message.getDescription());
        event.setStartTime(startTime);
        event.setEndTime(endTime);
        event.setType(type);
        event.setPosterUrl(message.getPosterUrl());
        event.setZone(zone);
        event.setSource(EventSource.SCRAPER);
        eventRepository.save(event);

        log.info("Событие афиши сохранено из Kafka: '{}' ({} - {})", message.getTitle(), startTime, endTime);
    }

    private EventType parseEventType(String rawType) {
        if (rawType == null) {
            return EventType.OTHER;
        }
        try {
            return EventType.valueOf(rawType.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return EventType.OTHER;
        }
    }

    private Zone resolveZone(String zoneHint, EventType type) {
        if (zoneHint != null && !zoneHint.isBlank()) {
            List<Zone> byName = zoneRepository.findByNameContainingIgnoreCase(zoneHint);
            if (!byName.isEmpty()) {
                return byName.get(0);
            }
        }
        ZoneType zoneType = ZONE_TYPE_BY_EVENT_TYPE.getOrDefault(type, ZoneType.PUBLIC);
        List<Zone> byType = zoneRepository.findByType(zoneType);
        return byType.isEmpty() ? null : byType.get(0);
    }
}
