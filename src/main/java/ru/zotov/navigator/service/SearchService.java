package ru.zotov.navigator.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.zotov.navigator.dto.EventDto;
import ru.zotov.navigator.dto.SearchResultDto;
import ru.zotov.navigator.dto.ZoneDto;
import ru.zotov.navigator.repository.EventRepository;
import ru.zotov.navigator.repository.ZoneRepository;

import java.util.List;

/**
 * Глобальный поиск по названиям зон и событий.
 */
@Service
@Transactional(readOnly = true)
public class SearchService {

    private final ZoneRepository zoneRepository;
    private final EventRepository eventRepository;

    public SearchService(ZoneRepository zoneRepository, EventRepository eventRepository) {
        this.zoneRepository = zoneRepository;
        this.eventRepository = eventRepository;
    }

    public SearchResultDto search(String query) {
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) {
            return SearchResultDto.builder().query(q).zones(List.of()).events(List.of()).build();
        }
        List<ZoneDto> zones = zoneRepository.findByNameContainingIgnoreCase(q).stream()
                .map(ZoneDto::from)
                .toList();
        List<EventDto> events = eventRepository.findByTitleContainingIgnoreCase(q).stream()
                .map(EventDto::from)
                .toList();
        return SearchResultDto.builder().query(q).zones(zones).events(events).build();
    }
}
