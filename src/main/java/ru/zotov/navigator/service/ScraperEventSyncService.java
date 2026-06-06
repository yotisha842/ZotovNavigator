package ru.zotov.navigator.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.zotov.navigator.model.*;
import ru.zotov.navigator.repository.EventRepository;
import ru.zotov.navigator.repository.ZoneRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Парсит афишу с centrezotov.ru и сохраняет новые события.
 *
 * <p>Включается через {@code zotov.scraper.enabled=true} в application.yml.
 * По умолчанию выключен — работает на тестовых данных из data.sql.</p>
 *
 * <p>Когда Центр «Зотов» откроет доступ к ELMA365 API, этот класс
 * заменяется на ElmaEventSyncService без изменения остального кода.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScraperEventSyncService implements EventSyncService {

    private static final String AFISHA_URL = "https://centrezotov.ru/afisha/";

    @Value("${zotov.scraper.enabled:false}")
    private boolean enabled;

    private final EventRepository eventRepository;
    private final ZoneRepository zoneRepository;

    /** Запускается раз в час. Интервал настраивается через zotov.scraper.interval-ms. */
    @Scheduled(fixedRateString = "${zotov.scraper.interval-ms:3600000}")
    @Transactional
    @Override
    public int syncEvents() {
        if (!enabled) {
            return 0;
        }
        log.info("Запуск синхронизации событий с {}", AFISHA_URL);
        try {
            Document doc = Jsoup.connect(AFISHA_URL)
                    .userAgent("Mozilla/5.0 (compatible; ZotovNavigator/1.0)")
                    .timeout(10_000)
                    .get();
            return processDocument(doc);
        } catch (Exception e) {
            log.error("Ошибка при парсинге афиши: {}", e.getMessage());
            return 0;
        }
    }

    private int processDocument(Document doc) {
        // Пробуем несколько возможных CSS-селекторов карточек событий
        Elements cards = doc.select(".event-card, .afisha-item, article.event");
        if (cards.isEmpty()) cards = doc.select("article");
        if (cards.isEmpty()) {
            log.warn("Карточки событий не найдены — сайт мог изменить вёрстку");
            return 0;
        }

        // Для дедупликации — ключи уже существующих событий от парсера
        Set<String> existing = eventRepository.findAllByOrderByStartTimeAsc().stream()
                .filter(e -> e.getSource() == EventSource.SCRAPER)
                .map(e -> dedupeKey(e.getTitle(), e.getStartTime()))
                .collect(Collectors.toSet());

        int saved = 0;
        for (Element card : cards) {
            try {
                int result = parseAndSave(card, existing);
                saved += result;
            } catch (Exception e) {
                log.warn("Пропускаем карточку: {}", e.getMessage());
            }
        }
        log.info("Синхронизация завершена: {} новых событий добавлено", saved);
        return saved;
    }

    private int parseAndSave(Element card, Set<String> existing) {
        String title = extractTitle(card);
        if (title == null || title.isBlank()) return 0;

        LocalDateTime startTime = extractDate(card);
        if (startTime == null) return 0;

        String key = dedupeKey(title, startTime);
        if (existing.contains(key)) return 0;

        String description = card.select("p, .description, .anons, .lead").text();
        EventType type = guessType(title + " " + description);
        Zone zone = resolveZone(type);
        if (zone == null) return 0;

        eventRepository.save(Event.builder()
                .title(title)
                .description(description.isBlank() ? null : description)
                .startTime(startTime)
                .zone(zone)
                .type(type)
                .source(EventSource.SCRAPER)
                .build());
        existing.add(key);
        return 1;
    }

    private String extractTitle(Element card) {
        Element h = card.selectFirst("h1, h2, h3, h4, .title, .name, .event__title");
        return h != null ? h.text().trim() : null;
    }

    private LocalDateTime extractDate(Element card) {
        // Ищем <time datetime="...">
        Element time = card.selectFirst("time[datetime]");
        if (time != null) {
            String attr = time.attr("datetime");
            try {
                return LocalDateTime.parse(attr, DateTimeFormatter.ISO_DATE_TIME);
            } catch (Exception ignored) {}
            try {
                return LocalDate.parse(attr, DateTimeFormatter.ISO_DATE).atTime(10, 0);
            } catch (Exception ignored) {}
        }
        // Альтернатива: текстовый элемент с датой
        Element dateEl = card.selectFirst(".date, .event__date, time");
        if (dateEl != null) {
            String text = dateEl.text().trim();
            // Формат "6 июня 2026" или "06.06.2026"
            LocalDateTime parsed = tryParseRussianDate(text);
            if (parsed != null) return parsed;
        }
        return null;
    }

    private LocalDateTime tryParseRussianDate(String text) {
        String[] months = {"января","февраля","марта","апреля","мая","июня",
                           "июля","августа","сентября","октября","ноября","декабря"};
        try {
            String[] parts = text.split("\\s+");
            if (parts.length >= 3) {
                int day = Integer.parseInt(parts[0]);
                int month = List.of(months).indexOf(parts[1].toLowerCase()) + 1;
                int year  = Integer.parseInt(parts[2]);
                if (month > 0) return LocalDate.of(year, month, day).atTime(10, 0);
            }
        } catch (Exception ignored) {}
        try {
            return LocalDate.parse(text, DateTimeFormatter.ofPattern("dd.MM.yyyy")).atTime(10, 0);
        } catch (Exception ignored) {}
        return null;
    }

    private EventType guessType(String text) {
        String lower = text.toLowerCase();
        if (lower.contains("выставк")) return EventType.EXHIBITION;
        if (lower.contains("лекц") || lower.contains("разговор") || lower.contains("дискусс"))
            return EventType.LECTURE;
        if (lower.contains("кино") || lower.contains("фильм") || lower.contains("показ") || lower.contains("кинопоказ"))
            return EventType.FILM;
        if (lower.contains("концерт") || lower.contains("музык") || lower.contains("перформанс"))
            return EventType.CONCERT;
        if (lower.contains("мастер") || lower.contains("воркшоп") || lower.contains("workshop"))
            return EventType.WORKSHOP;
        return EventType.OTHER;
    }

    private Zone resolveZone(EventType type) {
        ZoneType preferred = switch (type) {
            case EXHIBITION -> ZoneType.EXHIBITION;
            case LECTURE    -> ZoneType.LECTURE;
            case FILM       -> ZoneType.CINEMA;
            default         -> ZoneType.PUBLIC;
        };
        List<Zone> zones = zoneRepository.findByType(preferred);
        if (!zones.isEmpty()) return zones.get(0);
        // Фолбэк — любая PUBLIC зона
        List<Zone> pub = zoneRepository.findByType(ZoneType.PUBLIC);
        return pub.isEmpty() ? null : pub.get(0);
    }

    private String dedupeKey(String title, LocalDateTime time) {
        return title.toLowerCase().trim() + "|" + time.toLocalDate();
    }
}
